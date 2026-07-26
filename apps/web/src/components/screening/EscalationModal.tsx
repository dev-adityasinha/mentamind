import React from 'react';

interface EscalationModalProps {
    isOpen: boolean;
    message: string;
    onAcknowledge: () => void;
    crisisResources?: CrisisResource[];
}

interface CrisisResource {
    name: string;
    contact: string;
    description?: string;
}

const DEFAULT_CRISIS_RESOURCES: CrisisResource[] = [
    {
        name: 'National Suicide Prevention Lifeline',
        contact: '988 (US)',
        description: 'Call or text 988 — available 24/7',
    },
    {
        name: 'Crisis Text Line',
        contact: 'Text HOME to 741741',
        description: 'Free crisis counseling via text',
    },
    {
        name: 'iCall (India)',
        contact: '9152987821',
        description: 'Psychosocial helpline — Mon-Sat, 8am-10pm IST',
    },
    {
        name: 'Vandrevala Foundation (India)',
        contact: '1860-2662-345',
        description: '24/7 mental health helpline',
    },
];

export const EscalationModal: React.FC<EscalationModalProps> = ({
    isOpen,
    message,
    onAcknowledge,
    crisisResources = DEFAULT_CRISIS_RESOURCES,
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="escalation-title"
            aria-describedby="escalation-message"
        >
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-in">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    </div>
                    <h2 id="escalation-title" className="text-xl font-bold text-gray-800">
                        Your Safety Matters
                    </h2>
                </div>

                {/* Empathetic Message */}
                <p id="escalation-message" className="text-gray-600 leading-relaxed mb-6">
                    {message || "We're really glad you shared this with us. You're not alone, and help is available. What you're feeling is serious, and it's important that a trained person supports you right now."}
                </p>

                {/* Crisis Resources */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-3">
                        Crisis Support Resources
                    </h3>
                    <ul className="space-y-3">
                        {crisisResources.map((resource, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <span className="mt-0.5 w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-blue-900">{resource.name}</p>
                                    <p className="text-sm text-blue-700 font-mono">{resource.contact}</p>
                                    {resource.description && (
                                        <p className="text-xs text-blue-600 mt-0.5">{resource.description}</p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Safety Question */}
                <p className="text-gray-700 font-medium mb-6">
                    Are you safe right now? Please consider reaching out to one of the resources above or a trusted person in your life.
                </p>

                {/* Acknowledge */}
                <button
                    onClick={onAcknowledge}
                    className="w-full px-6 py-3 rounded-xl font-semibold text-white
                     bg-mentamind-600 hover:bg-mentamind-700 shadow-lg shadow-mentamind-200
                     transition-all focus:outline-none focus:ring-4 focus:ring-mentamind-200 min-h-[48px]"
                    autoFocus
                >
                    I understand, continue
                </button>
            </div>
        </div>
    );
};

export default EscalationModal;
