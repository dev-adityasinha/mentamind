import {
  IdentityVerifier,
  SendOtpResult,
  VerifyOtpResult,
} from '@mentamind/shared';

/**
 * Local stub implementation of IdentityVerifier.
 * Generates fake OTPs and always verifies successfully.
 * For development and testing only.
 */
export class LocalIdentityVerifier implements IdentityVerifier {
  private readonly otpStore = new Map<string, string>();

  async sendOtp(phone: string): Promise<SendOtpResult> {
    const requestId = this.generateRequestId();
    const otp = this.generateOtp();

    // Store the OTP for later verification
    this.otpStore.set(requestId, otp);

    console.log(
      `[LOCAL-ID-VERIFIER] OTP sent to ${phone}: ${otp} (requestId: ${requestId})`,
    );

    return {
      success: true,
      requestId,
    };
  }

  async verifyOtp(requestId: string, otp: string): Promise<VerifyOtpResult> {
    // Accept any 6-digit OTP as valid in local mode
    const isValidFormat = /^\d{6}$/.test(otp);

    if (!isValidFormat) {
      return {
        verified: false,
      };
    }

    // Clean up the stored OTP
    this.otpStore.delete(requestId);

    console.log(
      `[LOCAL-ID-VERIFIER] OTP verified for requestId: ${requestId}`,
    );

    return {
      verified: true,
      maskedReference: 'XXXX-XXXX-0000',
    };
  }

  getMaskedReference(rawIdentifier: string): string {
    const digits = rawIdentifier.replace(/\D/g, '');

    if (digits.length <= 4) {
      return `XXXX-XXXX-${digits.padStart(4, '0')}`;
    }

    const last4 = digits.slice(-4);
    return `XXXX-XXXX-${last4}`;
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
}
