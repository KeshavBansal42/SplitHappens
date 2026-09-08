import { LoginButton } from "../components/LoginButton";

export function LoginPage() {
  return (
    <main>
      <h1>SplitStream</h1>
      <p>
        Split shared expenses with friends. Pay your share from a Privy
        embedded wallet, no seed phrases.
      </p>
      <LoginButton />
    </main>
  );
}
