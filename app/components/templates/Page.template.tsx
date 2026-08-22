import { Heading } from "@/app/components/atoms/Heading.atom";
import { ReactNode } from "react";

export const PageTemplate = ({heading, children}: {heading: string; children: ReactNode}) => {
    return(
        <div className="p-4 flex flex-col gap-y-4 mx-auto container">
            <Heading>{heading}</Heading>
            {children}
        </div>
    );
}