import App from '../App';
import { AIAssistantProvider } from '../contexts/AIAssistantContext';
import { useAuth } from '../contexts/authState';

export function SessionWorkspace() {
  const { user } = useAuth();
  return (
    <AIAssistantProvider key={user?.id || 'guest'}>
      <App />
    </AIAssistantProvider>
  );
}
