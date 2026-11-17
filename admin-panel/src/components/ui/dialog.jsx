import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

/** Glass panel over a dimmed control room. */
const DialogContent = React.forwardRef(({ className, children, wide, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-deep/60 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_180ms_ease-out]" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-h-[calc(100vh-48px)] overflow-y-auto",
        wide ? "max-w-3xl" : "max-w-lg",
        "glass !bg-glass-solid shadow-lifted p-6",
        "data-[state=open]:animate-[sheet-in_280ms_cubic-bezier(0.16,1,0.3,1)]",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 p-1.5 rounded-sm text-ink-soft hover:text-ink hover:bg-paper">
        <X className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }) => (
  <div className={cn("mb-5 pr-8", className)} {...props} />
)

const DialogFooter = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6 pt-5 perf-h", className)} {...props} />
)

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-[22px] font-bold leading-tight", className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-ink-soft mt-1", className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

/** Labelled form field. */
const Field = ({ label, hint, error, children, className }) => (
  <label className={cn("block", className)}>
    <span className="block text-[14px] font-semibold mb-1.5">{label}</span>
    {children}
    {error ? <span className="block text-[13px] text-signal mt-1">{error}</span> : hint ? <span className="block text-[13px] text-ink-faint mt-1">{hint}</span> : null}
  </label>
)

export {
  Dialog,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Field,
}
