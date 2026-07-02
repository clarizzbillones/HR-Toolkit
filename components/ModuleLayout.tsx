import Sidebar from './Sidebar';
import UndoProvider from './UndoProvider';

interface Props {
  children: React.ReactNode;
  pendingTaskCount?: number;
}

export default function ModuleLayout({ children, pendingTaskCount }: Props) {
  return (
    <UndoProvider>
      <div className="flex h-screen w-full overflow-hidden bg-canvas">
        <Sidebar pendingTaskCount={pendingTaskCount} />
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">{children}</main>
      </div>
    </UndoProvider>
  );
}
