import { ButtonHTMLAttributes, forwardRef } from "react";
import { twMerge } from "tailwind-merge";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "outline" | "ghost" | "destructive";
	size?: "sm" | "md" | "lg";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
	primary:
		"bg-blue-600 text-white hover:bg-blue-600/90 active:scale-[0.98] shadow-md",
	outline:
		"border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
	ghost:
		"text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900",
	destructive:
		"bg-red-600 text-white hover:bg-red-600/90 active:scale-[0.98] shadow-md",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
	sm: "h-9 px-3 text-sm rounded-xl",
	md: "h-11 px-4 text-sm rounded-2xl",
	lg: "h-12 px-5 text-base rounded-2xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{ className, variant = "primary", size = "md", ...props },
	ref
) {
	return (
		<button
			ref={ref}
			className={twMerge(
				"inline-flex items-center justify-center transition-colors disabled:opacity-60",
				variantClasses[variant],
				sizeClasses[size],
				className
			)}
			{...props}
		/>
	);
});

export default Button;


