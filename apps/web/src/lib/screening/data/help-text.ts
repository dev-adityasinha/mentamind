/**
 * Contextual Help Text for all questionnaires.
 * Maps testId → questionId → help content.
 * 
 * This data powers the "Why this question?" tooltips per Task 4 requirements.
 * Language is non-clinical and reassuring throughout.
 */

export interface QuestionHelpText {
    helpText?: string;     // "What this means"
    whyText?: string;      // "Why we ask this"
    example?: string;      // An illustrative example
}

const helpTextData: Record<string, Record<string, QuestionHelpText>> = {
    // ──── PHQ-4 (Quick Mood Check) ──────────────
    'phq-4': {
        q1: {
            helpText: 'This asks about how often worry or nervousness has been part of your daily experience.',
            whyText: 'Anxiety often starts with persistent nervousness. Noticing this pattern early can help.',
            example: 'Feeling on edge before meetings, constantly worrying about things that might go wrong.',
        },
        q2: {
            helpText: 'This explores whether you\'ve had difficulty stopping your mind from worrying.',
            whyText: 'When worry becomes hard to control, it may be a sign to explore support.',
        },
        q3: {
            helpText: 'This asks about low mood or loss of interest in things you used to enjoy.',
            whyText: 'Changes in interest and enjoyment can be early indicators of emotional shifts.',
            example: 'Not feeling excited about hobbies, social activities, or things that usually make you happy.',
        },
        q4: {
            helpText: 'This explores feelings of sadness, emptiness, or hopelessness.',
            whyText: 'Persistent low mood is something worth paying attention to — it\'s not a character flaw.',
        },
    },

    // ──── PHQ-9 (Mood Assessment) ───────────────
    'phq-9': {
        q1: {
            helpText: 'This asks whether everyday activities have felt less enjoyable or interesting lately.',
            whyText: 'Loss of interest (called "anhedonia") is one of the important patterns to notice in mood changes.',
            example: 'Not wanting to see friends, not caring about hobbies, food tasting bland.',
        },
        q2: {
            helpText: 'This asks about persistent feelings of sadness, emptiness, or hopelessness.',
            whyText: 'Everyone feels down sometimes, but persistent low mood deserves gentle attention.',
        },
        q3: {
            helpText: 'This explores changes in your sleep patterns — both sleeping too much or too little.',
            whyText: 'Sleep and mood are closely connected. Changes in sleep often reflect changes in how we\'re feeling.',
        },
        q4: {
            helpText: 'This asks about your energy levels and whether daily tasks feel more tiring than usual.',
            whyText: 'Fatigue can be both a cause and effect of mood changes. Understanding this helps.',
        },
        q5: {
            helpText: 'This explores changes in appetite — eating much more or much less than normal.',
            whyText: 'Appetite changes often accompany shifts in mood and energy.',
        },
        q6: {
            helpText: 'This asks about feelings of guilt, worthlessness, or being hard on yourself.',
            whyText: 'Self-criticism is common but can become overwhelming. Recognizing it is the first step.',
        },
        q7: {
            helpText: 'This explores difficulty with concentration, like trouble reading or following conversations.',
            whyText: 'Concentration difficulties often show up alongside mood changes.',
            example: 'Rereading the same paragraph multiple times, zoning out during conversations.',
        },
        q8: {
            helpText: 'This asks about physical restlessness or the opposite — feeling slowed down.',
            whyText: 'Our bodies often reflect what\'s happening emotionally.',
        },
        q9: {
            helpText: 'This gently asks about thoughts of self-harm or feeling that life isn\'t worth living.',
            whyText: 'This question exists because your safety matters most. There is no judgment here — only care.',
        },
    },

    // ──── GAD-7 (Worry & Anxiety) ───────────────
    'gad-7': {
        q1: {
            helpText: 'This asks about feeling nervous, anxious, or on edge.',
            whyText: 'A general sense of unease can signal your body\'s stress response is active.',
            example: 'Feeling tense in your stomach, a racing heart without a clear reason.',
        },
        q2: {
            helpText: 'This explores how controllable your worrying feels.',
            whyText: 'When worry feels automatic and unstoppable, it can be especially draining.',
        },
        q3: {
            helpText: 'This asks whether you find yourself worrying about many different things.',
            whyText: 'Generalized worry (about many different topics) is a key pattern to notice.',
        },
        q4: {
            helpText: 'This explores whether relaxing has become difficult.',
            whyText: 'Difficulty unwinding can indicate your nervous system is on high alert.',
        },
        q5: {
            helpText: 'This asks about physical restlessness — feeling unable to sit still.',
            whyText: 'Anxiety often shows up in the body, not just the mind.',
        },
        q6: {
            helpText: 'This explores whether you\'ve been more easily irritated or annoyed.',
            whyText: 'Irritability is often a sign of underlying anxiety — not a character flaw.',
        },
        q7: {
            helpText: 'This asks about a sense of dread or fear that something bad might happen.',
            whyText: 'Anticipatory fear can be a sign of anxiety that deserves attention.',
        },
    },

    // ──── WHO-5 (Well-Being) ────────────────────
    'who-5': {
        q1: {
            helpText: 'This asks about feeling cheerful and in good spirits.',
            whyText: 'Positive emotions are an important part of overall well-being.',
        },
        q2: {
            helpText: 'This explores whether you\'ve felt calm and relaxed.',
            whyText: 'Inner calm is a sign that your emotional resources are in good shape.',
        },
        q3: {
            helpText: 'This asks about feeling active and energetic.',
            whyText: 'Energy levels reflect both physical and emotional health.',
        },
        q4: {
            helpText: 'This explores whether you\'ve been waking up feeling refreshed.',
            whyText: 'Morning freshness is a good indicator of sleep quality and overall well-being.',
        },
        q5: {
            helpText: 'This asks about your daily life feeling interesting and fulfilling.',
            whyText: 'A sense of meaning and interest in daily life is central to well-being.',
        },
    },

    // ──── ISI (Insomnia) ────────────────────────
    'isi': {
        q1: {
            helpText: 'This asks about difficulty falling asleep at the start of the night.',
            whyText: 'Trouble initiating sleep is one of the most common sleep concerns.',
            example: 'Lying in bed for 30+ minutes before falling asleep, mind racing at night.',
        },
        q2: {
            helpText: 'This explores waking up during the night and difficulty getting back to sleep.',
            whyText: 'Nighttime awakenings can fragment your sleep quality.',
        },
        q3: {
            helpText: 'This asks about waking up too early in the morning.',
            whyText: 'Early morning waking can be related to both sleep issues and mood changes.',
        },
        q4: {
            helpText: 'This explores how satisfied you are with your current sleep pattern.',
            whyText: 'Your perception of your sleep quality matters — it affects how you feel during the day.',
        },
        q5: {
            helpText: 'This asks whether sleep problems affect your daily functioning.',
            whyText: 'Understanding the daytime impact helps see the full picture of how sleep affects you.',
        },
        q6: {
            helpText: 'This explores how noticeable your sleep difficulties are to others.',
            whyText: 'Sometimes others notice changes in us before we do.',
        },
        q7: {
            helpText: 'This asks about how worried or distressed you feel about your sleep.',
            whyText: 'Worry about sleep can itself make sleep harder — it\'s a common pattern.',
        },
    },

    // ──── PSS-10 (Perceived Stress) ─────────────
    'pss-10': {
        q1: {
            helpText: 'This asks about being upset by something unexpected.',
            whyText: 'How we react to surprises tells us about our current stress reserves.',
        },
        q2: {
            helpText: 'This explores feeling unable to control important things in your life.',
            whyText: 'A sense of control is closely tied to stress levels.',
        },
        q3: {
            helpText: 'This asks about feeling nervous and stressed.',
            whyText: 'General tension is one of the clearest signals of stress.',
        },
        q4: {
            helpText: 'This asks about confidence in handling personal problems.',
            whyText: 'This is a positive indicator — feeling capable is a stress buffer.',
        },
        q5: {
            helpText: 'This explores feeling that things were going your way.',
            whyText: 'Positive experiences help balance out stressful ones.',
        },
    },

    // ──── RSES (Self-Esteem) ────────────────────
    'rses': {
        q1: {
            helpText: 'This asks about your overall sense of self-worth.',
            whyText: 'Self-esteem affects how we approach challenges and relationships.',
        },
        q2: {
            helpText: 'This explores whether you feel you have good qualities.',
            whyText: 'Recognizing your strengths is an important part of healthy self-image.',
        },
        q3: {
            helpText: 'This asks whether you sometimes feel like a failure.',
            whyText: 'Everyone has moments of self-doubt — this helps us understand how often this happens for you.',
        },
    },

    // ──── Suicide Risk (Safety Screening) ───────
    'suicide-risk': {
        q1: {
            helpText: 'This gently asks whether you\'ve wished you were dead or could go to sleep and not wake up.',
            whyText: 'Your safety is the most important thing. These feelings are more common than people realize, and help is available.',
        },
        q2: {
            helpText: 'This asks about having actual thoughts of ending your life.',
            whyText: 'Having these thoughts doesn\'t make you broken. It means you\'re in pain, and there are people who can help.',
        },
        q3: {
            helpText: 'This asks whether you\'ve thought about how you might do this.',
            whyText: 'When thoughts become more specific, it\'s especially important to connect with support.',
        },
        q4: {
            helpText: 'This asks about any intention to act on these thoughts.',
            whyText: 'We ask this because connecting you with help quickly is critical. You matter.',
        },
        q5: {
            helpText: 'This asks about any plans or preparations.',
            whyText: 'This helps us understand how urgently you might benefit from professional support.',
        },
        q6: {
            helpText: 'This asks about any past attempts.',
            whyText: 'Past experiences are important context. Everything shared here is confidential.',
        },
    },
};

/**
 * Get help text for a specific question in a test.
 */
export function getHelpText(testId: string, questionId: string): QuestionHelpText | null {
    return helpTextData[testId]?.[questionId] || null;
}

/**
 * Check if a test has any help text at all.
 */
export function hasHelpText(testId: string): boolean {
    return testId in helpTextData;
}

export default helpTextData;
