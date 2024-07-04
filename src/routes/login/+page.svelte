<script>
  import { supabase } from '../../lib/supabaseClient';
  import { getURL } from '$lib/helpers';

  let email = '';
  let error = '';

  const login = async () => {
    const { error: signInError } = await supabase.auth.signInWithOtp({ email });

    if (signInError) {
      error = signInError.message;
      return;
    }

    alert('Check your email for the magic link to log in.');
  };
</script>

<main>
  <h2>Login</h2>
  <form on:submit|preventDefault={login}>
    <input type="email" bind:value={email} placeholder="Enter your email" required />
    <button type="submit">Login</button>
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </form>
</main>

<style>
  html, body {
    font-family: 'Poppins', sans-serif;
    background-color: black;
    color: white;
    margin: 0;
    padding: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }

  main {
    background: #1c1c1c; /* Slightly lighter than black for contrast */
    padding: 2em;
    border-radius: 15px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    text-align: center;
    width: 80%;
    max-width: 400px;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  h2 {
    margin-bottom: 0.5em;
    font-family: 'Poppins', sans-serif;
  }

  form {
    font-family: 'Poppins', sans-serif;
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  input {
    padding: 0.5em;
    border: 1px solid #ddd;
    border-radius: 10px;
    background-color: black;
    color: white;
  }

  button {
    background-color: #000000;
    color: white;
    border: none;
    padding: 0.5em 1em;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1em;
    transition: background-color 0.3s ease;
  }

  button:hover {
    background-color: grey;
  }

  .error {
    color: red;
  }
</style>
