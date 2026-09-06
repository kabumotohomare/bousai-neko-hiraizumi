export type AppErrorCode = 'E1001' | 'E1002' | 'E1003' | 'E1004' | 'E2001' | 'E3001';

export interface AppError {
  code: AppErrorCode;
  message: string;
  cause?: unknown;
}
