import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

interface Option {
    value: string;
    label: string;
    subLabel?: string;
}

interface AutocompleteProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    error?: string;
}

export function Autocomplete({
    options,
    value,
    onChange,
    placeholder = "Select...",
    className,
    error,
}: AutocompleteProps) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
                // Reset input to selected value if closed without selecting
                if (inputValue !== value) {
                    setInputValue(value);
                }
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [inputValue, value]);

    const filteredOptions = options.filter((option) =>
        option.label.toLowerCase().includes(inputValue.toLowerCase())
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        setOpen(true);
        onChange(e.target.value); // Allow free text input
    };

    const handleSelect = (option: Option) => {
        setInputValue(option.label);
        onChange(option.label); // Or option.value if you prefer ID
        setOpen(false);
    };

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            <div className="relative">
                <input
                    type="text"
                    className={cn(
                        "w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                        error && "border-red-500 focus:border-red-500 focus:ring-red-500"
                    )}
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setOpen(true)}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronsUpDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                </div>
            </div>

            {open && filteredOptions.length > 0 && (
                <ul className="absolute z-[100] mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {filteredOptions.map((option) => (
                        <li
                            key={option.value}
                            className={cn(
                                "relative cursor-default select-none py-2 pl-3 pr-9 hover:bg-gray-100 text-gray-900",
                                value === option.label && "bg-gray-50 font-medium"
                            )}
                            onClick={() => handleSelect(option)}
                        >
                            <div className="flex flex-col">
                                <span className="block truncate">{option.label}</span>
                                {option.subLabel && (
                                    <span className="block truncate text-xs text-gray-500">
                                        {option.subLabel}
                                    </span>
                                )}
                            </div>
                            {value === option.label && (
                                <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-primary">
                                    <Check className="h-4 w-4" aria-hidden="true" />
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
    );
}
