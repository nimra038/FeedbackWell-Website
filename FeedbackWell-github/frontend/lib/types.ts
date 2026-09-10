export interface StaffUser { id: string; firstName: string; lastName: string; email: string; role: string; organizationId: string }
export interface Customer { id: string; firstName: string; lastName: string; email: string | null; phone?: string; companyName?: string; customerType: string; externalReference?: string; createdAt: string; status: string }
export interface DocumentRequest { id: string; title: string; description?: string; status: string; createdAt: string; dueDate: string | null; portalToken: string; customer: Customer; creator?: StaffUser; assignedUser?: StaffUser | null; progress?: { total: number; completed: number; missing: number } }
export interface UploadedDocument { id: string; originalName: string; mimeType: string; fileSize: number; malwareScanPassed: boolean }
export interface Requirement { documents?: UploadedDocument[]; id: string; name: string; description?: string; instructions?: string; required: boolean; status: string; acceptedFileTypes?: string[]; maxFileSizeMb?: number; minFiles: number; maxFiles?: number }
export interface RequestMessage { id: string; body: string; senderType: string; isInternal: boolean; createdAt: string }
export interface Organization { id: string; name: string; logo?: string; brand_color?: string; timezone: string; country: string }
