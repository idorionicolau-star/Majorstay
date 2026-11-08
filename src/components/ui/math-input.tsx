
import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Calculator, Delete, X, Equal, Plus, Minus, Divide } from "lucide-react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

interface MathInputProps extends React.ComponentProps<typeof Input> {
    onValueChange?: (value: number) => void;
    allowNegative?: boolean;
}

export const MathInput = React.forwardRef<HTMLInputElement, MathInputProps>(
    ({ className, onValueChange, onBlur, onKeyDown, allowNegative = false, ...props }, ref) => {
        const [localValue, setLocalValue] = React.useState<string>(props.value == null || Number(props.value) === 0 ? "" : props.value.toString());
        const [open, setOpen] = React.useState(false);

        React.useEffect(() => {
            setLocalValue(props.value == null || Number(props.value) === 0 ? "" : props.value.toString());
        }, [props.value]);

        const evaluateExpression = (expression: string): number | null => {
            try {
                const safeExpression = expression.replace(/[^0-9+\-*/().\s]/g, '');
                if (!safeExpression) return null;
                if (!isNaN(Number(safeExpression))) return Number(safeExpression);

                // eslint-disable-next-line no-new-func
                const result = new Function(`return ${safeExpression}`)();

                if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
                    let finalResult = allowNegative ? result : Math.max(0, result);
                    // Round to 2 decimals
                    return Math.round(finalResult * 100) / 100;
                }
                return null;
            } catch (error) {
                return null;
            }
        };

        const handleConfirm = () => {
            const result = evaluateExpression(localValue);
            if (result !== null) {
                setLocalValue(result.toString());
                if (onValueChange) onValueChange(result);
            }
        };

        const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
            if (!open) { // Only evaluate if popover is closed to avoid conflict
                handleConfirm();
            }
            if (onBlur) onBlur(e);
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
                setOpen(false);
            }
            if (onKeyDown) onKeyDown(e);
        };

        const handleKeypadClick = (key: string) => {
            if (key === 'C') {
                setLocalValue('');
            } else if (key === '=') {
                handleConfirm();
            } else if (key === 'backspace') {
                setLocalValue(prev => prev.slice(0, -1));
            } else {
                setLocalValue(prev => (prev === "0" && /[0-9]/.test(key) ? key : prev + key));
            }
        };

        const KeyButton = ({ char, label, variant = "outline", className, icon: Icon }: { char: string, label?: string, variant?: "outline" | "secondary" | "default" | "ghost" | "destructive", className?: string, icon?: React.ElementType }) => (
            <Button
                variant={variant}
                className={cn("h-10 text-sm font-medium", className)}
                onClick={() => handleKeypadClick(char)}
                type="button"
            >
                {Icon ? <Icon className="h-4 w-4" /> : (label || char)}
            </Button>
        );

        return (
            <div className="relative group">
                <Input
                    {...props}
                    ref={ref}
                    type="text"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className={cn("pr-10", className)}
                    placeholder={props.placeholder ?? "0"}
                    autoComplete="off"
                />
                <div className="absolute right-0 top-0 h-full flex items-center pr-2">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                <Calculator className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end">
                            <div className="grid grid-cols-4 gap-1">
                                <KeyButton char="C" variant="destructive" className="col-span-1 text-xs" />
                                <KeyButton char="(" variant="secondary" />
                                <KeyButton char=")" variant="secondary" />
                                <KeyButton char="/" label="÷" variant="secondary" />

                                <KeyButton char="7" />
                                <KeyButton char="8" />
                                <KeyButton char="9" />
                                <KeyButton char="*" label="×" variant="secondary" />

                                <KeyButton char="4" />
                                <KeyButton char="5" />
                                <KeyButton char="6" />
                                <KeyButton char="-" variant="secondary" />

                                <KeyButton char="1" />
                                <KeyButton char="2" />
                                <KeyButton char="3" />
                                <KeyButton char="+" variant="secondary" />

                                <KeyButton char="0" className="col-span-2" />
                                <KeyButton char="." />
                                <KeyButton char="=" variant="default" />

                                <Button
                                    variant="ghost"
                                    className="col-span-4 h-8 mt-1 text-xs text-muted-foreground"
                                    onClick={() => handleKeypadClick('backspace')}
                                >
                                    <Delete className="h-3 w-3 mr-2" /> Apagar
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        )
    }
)
MathInput.displayName = "MathInput"
