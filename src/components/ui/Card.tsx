import { HTMLAttributes, PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

type CardProps = HTMLAttributes<HTMLDivElement> & {
	interactive?: boolean;
	elevated?: boolean;
};

export function Card({
	className,
	interactive = false,
	elevated = false,
	...props
}: PropsWithChildren<CardProps>) {
	return (
		<div
			className={twMerge(
				"rounded-2xl border border-zinc-200/70 bg-white/95 dark:border-zinc-800/70 dark:bg-zinc-900/85",
				"ring-1 ring-white/70 dark:ring-zinc-900/40",
				elevated ? "shadow-[var(--shadow-md)]" : "shadow-[var(--shadow-sm)]",
				interactive ? "transition-shadow hover:shadow-[var(--shadow-md)]" : "",
				className
			)}
			{...props}
		/>
	);
}

export function CardHeader({
	className,
	...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
	return <div className={twMerge("p-4", className)} {...props} />;
}

export function CardTitle({
	className,
	...props
}: PropsWithChildren<HTMLAttributes<HTMLParagraphElement>>) {
	return (
		<p
			className={twMerge("text-base font-semibold leading-none", className)}
			{...props}
		/>
	);
}

export function CardDescription({
	className,
	...props
}: PropsWithChildren<HTMLAttributes<HTMLParagraphElement>>) {
	return (
		<p className={twMerge("text-sm text-zinc-500 dark:text-zinc-400", className)} {...props} />
	);
}

export function CardContent({
	className,
	...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
	return <div className={twMerge("px-4 pb-4", className)} {...props} />;
}

export function CardFooter({
	className,
	...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
	return (
		<div className={twMerge("px-4 pb-4 pt-2", className)} {...props} />
	);
}



