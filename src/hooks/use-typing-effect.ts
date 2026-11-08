import { useState, useEffect } from 'react';

export function useTypingEffect(
    text: string,
    speed: number = 20,
    enabled: boolean = true,
    onComplete?: () => void
) {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        if (!enabled || !text) {
            setDisplayedText(text || '');
            if (text && onComplete) onComplete();
            return;
        }

        let i = 0;
        setDisplayedText('');

        const intervalId = setInterval(() => {
            setDisplayedText(text.slice(0, i + 1));
            i++;
            if (i >= text.length) {
                clearInterval(intervalId);
                if (onComplete) onComplete();
            }
        }, speed);

        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, speed, enabled]);

    return displayedText;
}
