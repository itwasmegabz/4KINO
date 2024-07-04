<script>
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabaseClient';
  import { user } from '../stores/user';
  import { goto } from '$app/navigation';

  onMount(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const access_token = urlParams.get('access_token');

    if (access_token) {
      const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
      if (error) {
        console.error('Error retrieving session from URL:', error.message);
      } else {
        user.set(data.session.user);
        window.history.replaceState({}, document.title, window.location.pathname);
        goto('/feed'); // Redirect to feed after login
      }
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      user.set(session?.user ?? null);
      if (session) {
        goto('/feed'); // Redirect to feed if already logged in
      }
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      user.set(session?.user ?? null);
      if (session) {
        goto('/feed'); // Redirect to feed if session changes
      }
    });
  });
</script>

<main>
  <h1>Welcome to 4Kino</h1>
  <nav>
    <ul>
      <li><button on:click={() => goto('/login')}>Login</button></li>
      <li><button on:click={() => goto('/register')}>Register</button></li>
    </ul>
  </nav>
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    font-family: 'Poppins', sans-serif;
    background: #fff;
    border-radius: 15px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80%;
    max-width: 400px;
  }

  nav ul {
    list-style: none;
    padding: 0;
    display: flex;
    justify-content: center;
    gap: 1em;
  }

  nav ul li {
    margin: 1em 0;
  }

  nav ul li button {
    text-decoration: none;
    background-color: black;
    color: white;
    border: none;
    padding: 0.5em 1em;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1em;
    transition: background-color 0.3s ease;
  }

  nav ul li button:hover {
    background-color: grey;
  }

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
    color: white;
  }

  form {
    font-family: 'Poppins', sans-serif;
    display: flex;
    flex-direction: column;
    gap: 1em;
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

