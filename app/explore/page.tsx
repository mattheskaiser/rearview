import { Heading } from "@/app/components/atoms/Heading.atom";
import { Textarea } from "@/components/ui/textarea"

const Explore = () => {
    return (
        <div className="w-full p-2 flex flex-col justify-center items-center">
            <Heading className="-mt-56">Hi Matthes, let's take a look in the rearview?</Heading>
            <Textarea></Textarea>
        </div>
    )
}

export default Explore;