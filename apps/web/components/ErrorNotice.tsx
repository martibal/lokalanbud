/** Viser en feilmelding som kom tilbake fra en handling via ?feil=. */
export function ErrorNotice({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p className="form-error" role="alert">
      {message.slice(0, 200)}
    </p>
  );
}
