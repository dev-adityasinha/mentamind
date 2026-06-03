export interface SendOtpResult {
  success: boolean;
  requestId: string;
}

export interface VerifyOtpResult {
  verified: boolean;
  maskedReference?: string; // e.g. "XXXX-XXXX-1234"
}

export interface IdentityVerifier {
  sendOtp(phone: string): Promise<SendOtpResult>;
  verifyOtp(requestId: string, otp: string): Promise<VerifyOtpResult>;
  getMaskedReference(rawIdentifier: string): string;
}
