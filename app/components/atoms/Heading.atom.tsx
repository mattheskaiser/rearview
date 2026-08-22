import { cn } from "@/lib/utils";
import { ClassValue } from "clsx";

export const Heading = ({children, className}: {children: string; className?: ClassValue}) => {
    return(
        <h1 className={cn("text-3xl", {className})}>{children}</h1>
    )
}