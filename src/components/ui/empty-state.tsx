import { memo } from "react";
import { Package, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
  iconClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export const EmptyState = memo(
  ({
    title,
    description,
    icon: Icon = Package,
    className,
    iconClassName,
    titleClassName,
    descriptionClassName,
  }: EmptyStateProps) => (
    <div className={cn("text-center py-12 text-muted-foreground", className)}>
      <Icon
        className={cn("mx-auto h-12 w-12 text-muted-foreground", iconClassName)}
      />
      <h3
        className={cn(
          "mt-4 text-lg font-medium text-foreground",
          titleClassName
        )}
      >
        {title}
      </h3>
      <p className={cn("mt-1 text-sm", descriptionClassName)}>{description}</p>
    </div>
  )
);

EmptyState.displayName = "EmptyState";
