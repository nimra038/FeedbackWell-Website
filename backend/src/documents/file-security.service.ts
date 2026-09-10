import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import FileType from 'file-type';
import { connect } from 'net';

const supported = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/heic',
  'text/plain',
]);

@Injectable()
export class FileSecurityService {
  async inspect(
    buffer: Buffer,
    claimedMime: string,
  ): Promise<string> {
    let detected: Awaited<
      ReturnType<typeof FileType.fromBuffer>
    >;

    try {
      detected = await FileType.fromBuffer(buffer);
    } catch {
      throw new BadRequestException(
        'The uploaded file is invalid or damaged',
      );
    }

    let mime: string | undefined = detected?.mime;

    if (
      !mime &&
      ['text/plain', 'text/csv'].includes(claimedMime)
    ) {
      try {
        new TextDecoder('utf-8', {
          fatal: true,
        }).decode(buffer);
      } catch {
        throw new BadRequestException(
          'Invalid text encoding',
        );
      }

      if (buffer.includes(0)) {
        throw new BadRequestException(
          'Binary data is not a text document',
        );
      }

      mime = claimedMime;
    }

    if (mime === 'application/x-cfb') {
      mime = this.compoundOfficeMime(buffer);
    }

    if (!mime || !supported.has(mime)) {
      throw new BadRequestException(
        'Unsupported or unrecognized file content',
      );
    }

    if (
      mime !== claimedMime &&
      claimedMime !== 'application/octet-stream'
    ) {
      throw new BadRequestException(
        'File content does not match its declared type',
      );
    }

    return mime;
  }

  private compoundOfficeMime(
    buffer: Buffer,
  ): string | undefined {
    try {
      if (
        buffer.length < 512 ||
        buffer.readUInt16LE(28) !== 0xfffe
      ) {
        return undefined;
      }

      const shift = buffer.readUInt16LE(30);

      if (![9, 12].includes(shift)) {
        return undefined;
      }

      const size = 2 ** shift;
      const count = Math.floor(buffer.length / size) - 1;

      const sector = (id: number): Buffer => {
        if (id >= count) {
          throw new Error(
            'Invalid compound file sector',
          );
        }

        return buffer.subarray(
          (id + 1) * size,
          (id + 2) * size,
        );
      };

      const fatIds: number[] = [];

      for (let index = 0; index < 109; index++) {
        const id = buffer.readUInt32LE(
          76 + index * 4,
        );

        if (id < 0xfffffffa) {
          fatIds.push(id);
        }
      }

      let difat = buffer.readUInt32LE(68);
      const seen = new Set<number>();

      while (difat < 0xfffffffa) {
        if (
          seen.has(difat) ||
          seen.size > count
        ) {
          return undefined;
        }

        seen.add(difat);

        const block = sector(difat);

        for (
          let index = 0;
          index < size / 4 - 1;
          index++
        ) {
          const id = block.readUInt32LE(
            index * 4,
          );

          if (id < 0xfffffffa) {
            fatIds.push(id);
          }
        }

        difat = block.readUInt32LE(size - 4);
      }

      if (
        fatIds.length !==
        buffer.readUInt32LE(44)
      ) {
        return undefined;
      }

      const fat = Buffer.concat(
        fatIds.map(sector),
      );

      let directory = buffer.readUInt32LE(48);

      seen.clear();

      const streams = new Set<string>();

      while (directory < 0xfffffffa) {
        if (
          seen.has(directory) ||
          seen.size > 8192
        ) {
          return undefined;
        }

        seen.add(directory);

        const block = sector(directory);

        for (
          let offset = 0;
          offset < size;
          offset += 128
        ) {
          const length = block.readUInt16LE(
            offset + 64,
          );

          if (
            block[offset + 66] === 2 &&
            length >= 2 &&
            length <= 64 &&
            block.readUInt32LE(offset + 120) > 0
          ) {
            const streamName = block
              .subarray(
                offset,
                offset + length - 2,
              )
              .toString('utf16le');

            streams.add(streamName);
          }
        }

        directory = fat.readUInt32LE(
          directory * 4,
        );
      }

      const word = streams.has('WordDocument');

      const excel =
        streams.has('Workbook') ||
        streams.has('Book');

      if (word === excel) {
        return undefined;
      }

      return word
        ? 'application/msword'
        : 'application/vnd.ms-excel';
    } catch {
      return undefined;
    }
  }

  async scan(buffer: Buffer): Promise<void> {
    const host = process.env.CLAMAV_HOST;

    if (!host) {
      throw new ServiceUnavailableException(
        'File scanning is not configured. Please contact your lender.',
      );
    }

    await new Promise<void>((resolve, reject) => {
      const socket = connect({
        host,
        port: Number(
          process.env.CLAMAV_PORT || 3310,
        ),
      });

      let response = '';
      let settled = false;

      const finish = (error?: Error): void => {
        if (settled) {
          return;
        }

        settled = true;
        socket.destroy();

        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      socket.setTimeout(30000, () => {
        finish(
          new ServiceUnavailableException(
            'File scanning timed out. Please retry.',
          ),
        );
      });

      socket.on('error', () => {
        finish(
          new ServiceUnavailableException(
            'File scanner is unavailable. Please retry later.',
          ),
        );
      });

      socket.on('data', (chunk) => {
        response += chunk.toString();

        if (response.includes('FOUND')) {
          finish(
            new BadRequestException(
              'This file was rejected by the malware scanner',
            ),
          );
        } else if (
          /stream: OK[\0\n]/.test(response)
        ) {
          finish();
        } else if (
          response.includes('ERROR') ||
          response.length > 4096
        ) {
          finish(
            new ServiceUnavailableException(
              'File scanning could not complete',
            ),
          );
        }
      });

      socket.on('close', () => {
        if (!settled) {
          finish(
            new ServiceUnavailableException(
              'File scanning could not complete',
            ),
          );
        }
      });

      socket.on('connect', () => {
        socket.write('zINSTREAM\0');

        for (
          let offset = 0;
          offset < buffer.length;
          offset += 65536
        ) {
          const chunk = buffer.subarray(
            offset,
            offset + 65536,
          );

          const length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length);

          socket.write(length);
          socket.write(chunk);
        }

        socket.write(Buffer.alloc(4));
      });
    });
  }
}
