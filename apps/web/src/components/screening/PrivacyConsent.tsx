import React from 'react';

interface PrivacyConsentProps {
    onAccept: () => void;
}

export const PrivacyConsent: React.FC<PrivacyConsentProps> = ({ onAccept }) => {
    return (
        <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
            <div className="max-w-md w-full animate-fade-slide">
                {/* Icon */}
                <div className="w-16 h-16 bg-mentamind-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-mentamind-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                </div>

                <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">
                    Before we begin
                </h1>
                <p className="text-sm text-gray-400 text-center mb-6">
                    A few things about your privacy and safety
                </p>

                {/* Privacy cards */}
                <div className="space-y-3 mb-8">
                    <div className="glass-card rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <span className="text-lg flex-shrink-0">🔒</span>
                            <div>
                                <p className="font-medium text-gray-700 text-sm">Your answers stay private</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Your responses are stored only on this device.
                                    Nothing is sent to any server without your consent.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <span className="text-lg flex-shrink-0">🩺</span>
                            <div>
                                <p className="font-medium text-gray-700 text-sm">Screening, not diagnosis</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    These are validated screening tools, but they cannot replace
                                    a professional evaluation. Results help you understand patterns,
                                    not define you.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <span className="text-lg flex-shrink-0">💚</span>
                            <div>
                                <p className="font-medium text-gray-700 text-sm">No judgment, no pressure</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Take your time. You can go back, skip, or stop at any point.
                                    This is a safe space for self-reflection.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <span className="text-lg flex-shrink-0">🆘</span>
                            <div>
                                <p className="font-medium text-gray-700 text-sm">We care about your safety</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    If any of your responses suggest you may need immediate support,
                                    we&apos;ll share helpful resources and helpline information.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onAccept}
                    className="w-full px-6 py-4 rounded-2xl font-semibold text-white text-lg
                           bg-mentamind-600 hover:bg-mentamind-700 shadow-lg shadow-mentamind-200/60
                           transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-mentamind-200 min-h-[56px]
                           active:scale-[0.98]"
                    autoFocus
                >
                    I understand, let&apos;s begin
                </button>

                <p className="text-center mt-4">
                    <a
                        href="https://mentamind.in"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-mentamind-600 hover:text-mentamind-700 transition-colors"
                    >
                        Learn more about Mentamind →
                    </a>
                </p>
            </div>
        </div>
    );
};

export default PrivacyConsent;
