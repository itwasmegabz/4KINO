<script>
  import { supabase } from '../../lib/supabaseClient';

  let username = '';
  let email = '';
  let error = '';

  const register = async () => {
    // Check if the email or username already exists
    let { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .or(`email.eq.${email},username.eq.${username}`)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing profile:', fetchError);
      error = 'Error checking existing profile: ' + fetchError.message;
      return;
    }

    if (existingProfile) {
      error = 'Email or username already exists';
      return;
    }

    const dummyPassword = 'SupabaseDummyPassword123!';

    const { error: signupError, data: signupData } = await supabase.auth.signUp({
      email,
      password: dummyPassword,
    });

    if (signupError) {
      console.error('Signup error:', signupError); // Detailed log
      error = 'Error during signup: ' + signupError.message;
      return;
    }

    const user = signupData.user;

    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: user.id,
          email: user.email,
          username: username,
        },
      ]);

    if (profileError) {
      console.error('Profile error:', profileError); // Detailed log
      error = 'Database error saving new user: ' + profileError.message;
      return;
    }

    alert('Check your email for the magic link to log in.');
  };
</script>

<main>
  <h2>Register</h2>
  <form on:submit|preventDefault={register}>
    <input type="text" bind:value={username} placeholder="Enter your username" required />
    <input type="email" bind:value={email} placeholder="Enter your email" required />
    <button type="submit">Register</button>
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
