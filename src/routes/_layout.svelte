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
        goto('/feed');  // Redirect to feed after login
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

  const signOut = async () => {
    await supabase.auth.signOut();
    user.set(null);
    goto('/'); // Redirect to home after sign out
  };
</script>

<main>
  <nav>
    {#if $user}
      <p>Welcome, {$user.email}</p>
      <button on:click={signOut}>Sign Out</button>
    {:else}
      <ul>
        <li><a href="/register">Register</a></li>
        <li><a href="/login">Login</a></li>
      </ul>
    {/if}
  </nav>
  <slot></slot>
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    background-color: black
  }

  html, body {
    background-color: black;
    color: white;
    font-family: 'Poppins', sans-serif;
    margin: 0;
    padding: 0;
  
  
}


  nav ul {
    list-style: none;
    padding: 0;
  }

  nav ul li {
    display: inline;
    margin-right: 1em;
  }

  nav p {
    display: inline;
    margin-right: 1em;
  }
</style>
