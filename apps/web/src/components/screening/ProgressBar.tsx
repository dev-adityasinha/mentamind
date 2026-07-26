import React from 'react';

interface ProgressBarProps {
    current: number;   // 1-based
    total: number;
    testTitle?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, testTitle }) => {
    const progress = Math.round((current / total) * 100);

    return (
        <div className="w-full" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total} aria-label={`Progress: question ${current} of ${total}`}>
            <div className="flex items-center justify-between mb-2 px-1">
                {testTitle && (
                    <span className="text-xs font-medium text-mentamind-700 truncate">
                        {testTitle}
                    </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">
                    {current}/{total}
                </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-mentamind-400 to-mentamind-600 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

export default ProgressBar;
