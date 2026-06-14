import { Inbox } from "lucide-react";

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="surface flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#f5f4f1" }}>
        <Inbox className="h-5 w-5 text-gray-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="max-w-sm text-sm text-gray-500">{message}</p>
    </div>
  );
}
