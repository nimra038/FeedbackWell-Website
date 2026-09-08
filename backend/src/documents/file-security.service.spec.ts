import { FileSecurityService } from './file-security.service';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createServer } from 'net';

const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
describe('File content validation', () => {
  const service = new FileSecurityService();
  it('recognizes PDF content', async () => expect(await service.inspect(pdf, 'application/pdf')).toBe('application/pdf'));
  it('rejects a renamed executable', async () => {
    await expect(service.inspect(Buffer.from('MZ' + 'x'.repeat(200)), 'application/pdf')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects a declared MIME that disagrees with the content', async () => {
    await expect(service.inspect(pdf, 'image/png')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('accepts readable CSV', async () => expect(await service.inspect(Buffer.from('name,value\nDemo,100'), 'text/csv')).toBe('text/csv'));
  it('rejects binary data disguised as text', async () => {
    await expect(service.inspect(Buffer.from([0,1,2,3]), 'text/plain')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('fails closed if no scanner is configured', async () => {
    const host = process.env.CLAMAV_HOST; delete process.env.CLAMAV_HOST;
    try { await expect(service.scan(pdf)).rejects.toBeInstanceOf(ServiceUnavailableException); }
    finally { if (host === undefined) delete process.env.CLAMAV_HOST; else process.env.CLAMAV_HOST = host; }
  });
  it.each(['OK', 'Test-Virus FOUND', 'scanner ERROR'])('handles the scanner result %s', async result => {
    const server = createServer(socket => socket.once('data', () => socket.end(`stream: ${result}\0`)));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const oldHost = process.env.CLAMAV_HOST; const oldPort = process.env.CLAMAV_PORT;
    process.env.CLAMAV_HOST = '127.0.0.1'; process.env.CLAMAV_PORT = String((server.address() as { port: number }).port);
    try {
      if (result === 'OK') await expect(service.scan(pdf)).resolves.toBeUndefined();
      else await expect(service.scan(pdf)).rejects.toBeDefined();
    } finally {
      if (oldHost === undefined) delete process.env.CLAMAV_HOST; else process.env.CLAMAV_HOST = oldHost;
      if (oldPort === undefined) delete process.env.CLAMAV_PORT; else process.env.CLAMAV_PORT = oldPort;
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
