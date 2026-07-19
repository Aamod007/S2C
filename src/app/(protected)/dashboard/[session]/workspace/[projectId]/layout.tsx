export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Workspace Sidebar will go here in Phase 4 */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}
