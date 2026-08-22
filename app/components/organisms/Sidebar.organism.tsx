"use client";
import { cn } from '@/lib/utils';
import { usePathname, useRouter } from 'next/navigation'

export const Sidebar = ({items}: {items: {label: string; href: string;}[]}) => {
    const router = useRouter()
    const pathname = usePathname()

    console.log(pathname)

    return(
        <div className='w-48 border-r shadow-lg flex flex-col p-2'>
          {items.map((item) => (
            <a key={item.label} onClick={() => router.push(item.href)} className={cn('p-2 hover:cursor-pointer hover:bg-secondary rounded-lg', {
                "bg-primary": pathname === item.href
            })}>
                {item.label}
            </a>
          ))}
        </div>
    );
}