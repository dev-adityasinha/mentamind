"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export function AuthContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left panel */}
      <div className="flex flex-col gap-4 p-6 md:p-10 bg-bg">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium text-text-primary">
            <Image src="/logo/mentamind.webp" alt="Mentamind Logo" width={24} height={24} className="object-contain" />
            Mentamind
          </a>
        </div>

        <div className="flex flex-1 items-center justify-center py-8 overflow-hidden">
          <div className="w-full max-w-sm relative">
            <motion.div
              layout
              className="relative w-full rounded-xl border border-border bg-surface shadow-sm overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, type: "spring", bounce: 0 }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={pathname}
                  className="w-full"
                  initial={{ opacity: 0, filter: "blur(4px)", scale: 0.96 }}
                  animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                  exit={{ opacity: 0, filter: "blur(4px)", scale: 0.96 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <div className="p-8">
                    {children}
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Right panel - image, hidden on mobile */}
      <div className="relative hidden bg-muted lg:block">
        <Image
          src="/auth-bg.jpg"
          alt=""
          fill
          className="object-cover"
        />
      </div>
    </div>
  );
}
