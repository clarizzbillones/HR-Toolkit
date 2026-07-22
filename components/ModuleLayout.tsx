import Sidebar from './Sidebar';
import UndoProvider from './UndoProvider';
import AccessProvider from './AccessProvider';
import AccessGate from './AccessGate';

interface Props {
  children: React.ReactNode;
  pendingTaskCount?: number;
}

export default function ModuleLayout({ children, pendingTaskCount }: Props) {
  return (
    <UndoProvider>
      <AccessProvider>
        <div className="flex h-screen w-full overflow-hidden bg-canvas">
          <Sidebar pendingTaskCount={pendingTaskCount} />
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <AccessGate>{children}</AccessGate>
          </main>
        </div>
      </AccessProvider>
    </UndoProvider>
  );
}
