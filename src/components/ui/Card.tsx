import { HTMLAttributes, PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

export function Card({
	className,
	...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
	return (
		<div
			className={twMerge(
				"rounded-2xl border border-zinc-200 bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-900",
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
		<p className={twMerge("text-sm text-zinc-500", className)} {...props} />
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



