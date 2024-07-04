<head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
</head>

<script>
  import { supabase } from '../../lib/supabaseClient';
  import { onMount } from 'svelte';
  import { user } from '../../stores/user';
  import { writable, get } from 'svelte/store';
  import CommentComponent from './components/CommentComponent.svelte';
  
  const text = writable('');
  const error = writable('');
  const posts = writable([]);
  const comments = writable({});
  const newComment = writable({});
  const showCommentBox = writable({});
  const showComments = writable({});
  const commentsLoading = writable(false);


// Auto-resize function for textarea
const autoResizeTextarea = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };


  const fetchPosts = async () => {
    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      return;
    }

    const postsWithCommentsCount = await Promise.all(postsData.map(async post => {
      const { data: commentsCount, error: commentsCountError } = await supabase
        .from('comments')
        .select('id, parent_id')
        .eq('post_id', post.id)
        .is('parent_id', null);

      if (commentsCountError) {
        console.error('Error fetching top-level comments count:', commentsCountError);
        return {
          ...post,
          comments_count: 0
        };
      }

      return {
        ...post,
        comments_count: commentsCount.length
        
      };
    }));

    posts.set(postsWithCommentsCount);
    fetchCommentsForPosts(postsWithCommentsCount);
  };

  const fetchCommentsForPost = async (postId) => {
    commentsLoading.update(state => ({ ...state, [postId]: true }));

    const postComments = await fetchComments(postId);
    comments.update(state => ({ ...state, [postId]: buildCommentTree(postComments) }));

    commentsLoading.update(state => ({ ...state, [postId]: false }));
  };

  const fetchComments = async (postId) => {
    const { data: commentsData, error } = await supabase
      .from('comments')
      .select('*, profiles(username)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      return [];
    }

    const commentMap = {};
    commentsData.forEach(comment => {
      comment.replies_count = 0;
      commentMap[comment.id] = comment;
    });

    commentsData.forEach(comment => {
      if (comment.parent_id && commentMap[comment.parent_id]) {
        commentMap[comment.parent_id].replies_count += 1;
      }
    });

    return commentsData;
  };

  const buildCommentTree = (commentsData) => {
    const map = {};
    const roots = [];

    commentsData.forEach(comment => {
      comment.children = [];
      map[comment.id] = comment;

      if (comment.parent_id === null) {
        roots.push(comment);
      } else if (map[comment.parent_id]) {
        map[comment.parent_id].children.push(comment);
      }
    });

    return roots;
  };

  const submitPost = async () => {
  const currentUser = get(user);

  if (!currentUser) {
    error.set('You must be logged in to submit a post');
    return;
  }

  if (get(text).trim() === '') {
    error.set('Post content cannot be empty');
    return;
  }

  const fileInput = document.getElementById('post-image');
  const file = fileInput.files[0];
  let fileUrl = '';

  if (file) {
    const uniqueFileName = `${currentUser.id}-${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(`public/${uniqueFileName}`, file);

    if (uploadError) {
      error.set(uploadError.message);
      return;
    }

    const { data: publicUrlData, error: urlError } = supabase.storage
      .from('uploads')
      .getPublicUrl(`public/${uniqueFileName}`);

    if (urlError) {
      error.set(urlError.message);
      return;
    }

    fileUrl = publicUrlData.publicUrl;
  }

  const { error: insertError } = await supabase
    .from('posts')
    .insert([{
      content: get(text),
      user_id: currentUser.id,
      file_url: fileUrl,
      created_at: new Date()
    }]);

  if (insertError) {
    error.set(insertError.message);
    return;
  }

  text.set('');
  fetchPosts();
};



  const deletePost = async (postId) => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      console.error('Error deleting post:', error);
      return;
    }

    fetchPosts();
  };

  const deleteComment = async (commentId, postId, parentId = null) => {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      return;
    }

    // Update local comments state
    comments.update(currentComments => {
      const updatedComments = { ...currentComments };
      const postComments = updatedComments[postId] || [];
      
      // Find the index of the comment to delete
      const index = postComments.findIndex(comment => comment.id === commentId);
      if (index !== -1) {
        postComments.splice(index, 1);
        updatedComments[postId] = postComments;
      }

      return updatedComments;
    });

    // Update the comments count in the posts state
    posts.update(currentPosts => {
      return currentPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments_count: post.comments_count - 1
          };
        }
        return post;
      });
    });
  };

  const submitComment = async (postId, content, parentId = null) => {
    const currentUser = get(user);

    if (!currentUser) {
      error.set('You must be logged in to submit a comment');
      return;
    }

    if (content.trim() === '') {
      
      return;
    }

    const { data: insertedComment, error: insertError } = await supabase
      .from('comments')
      .insert([{
        post_id: postId,
        user_id: currentUser.id,
        content,
        parent_id: parentId,
        created_at: new Date()
      }])
      .select('*, profiles(username)')
      .single();

    if (insertError) {
      error.set(insertError.message);
      return;
    }

    // Update comments in local state
    comments.update(state => {
      const postComments = state[postId] || [];
      postComments.push(insertedComment);
      state[postId] = postComments;
      return state;
    });

    newComment.update(state => ({ ...state, [parentId || postId]: '' }));

    // Update the comments count in the posts state
    posts.update(currentPosts => {
      return currentPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments_count: post.comments_count + 1
          };
        }
        return post;
      });
    });

    // Show comments for the post if not already visible
    showComments.update(state => {
      if (!state[postId]) {
        state[postId] = true;
      }
      return state;
    });

    showCommentBox.update(state => ({ ...state, [postId]: false }));
  };

  const updateInteraction = async (postId, type) => {
    const currentUser = get(user);
    if (!currentUser) {
      console.log('You must be logged in to interact');
      return;
    }

    console.log('Fetching existing interaction...');
    const { data: existingInteraction, error: fetchInteractionError } = await supabase
      .from('post_interactions')
      .select('id, interaction_type')
      .eq('post_id', postId)
      .eq('user_id', currentUser.id)
      .single();

    if (fetchInteractionError && fetchInteractionError.code !== 'PGRST116') {
      console.error('Error fetching interaction:', fetchInteractionError);
      return;
    }

    console.log('Existing interaction:', existingInteraction);

    if (existingInteraction) {
      if (existingInteraction.interaction_type === type) {
        console.log('Removing existing interaction (unlike/undislike)...');
        const { error: deleteError } = await supabase
          .from('post_interactions')
          .delete()
          .eq('id', existingInteraction.id);

        if (deleteError) {
          console.error('Error deleting interaction:', deleteError);
          return;
        }

        console.log('Interaction removed.');
      } else {
        console.log('Switching interaction type (like to dislike or vice versa)...');
        const { error: updateInteractionError } = await supabase
          .from('post_interactions')
          .update({ interaction_type: type })
          .eq('id', existingInteraction.id);

        if (updateInteractionError) {
          console.error('Error updating interaction:', updateInteractionError);
          return;
        }

        console.log('Interaction updated.');
      }
    } else {
      console.log('Inserting new interaction...');
      const { data: insertedInteraction, error: insertError } = await supabase
        .from('post_interactions')
        .insert([{ post_id: postId, user_id: currentUser.id, interaction_type: type }])
        .select('id, interaction_type, created_at');

      if (insertError) {
        console.error('Error inserting interaction:', insertError);
        return;
      }

      console.log('Interaction inserted:', insertedInteraction);
    }

    console.log('Fetching updated posts...');
    await fetchPosts();
    console.log('Interaction update complete.');
  };

  const toggleCommentBox = (postId) => {
    showCommentBox.update(state => ({ ...state, [postId]: !state[postId] }));
  };

  const toggleCommentsVisibility = (postId) => {
    const currentState = get(showComments);
    if (!currentState[postId]) {
      fetchCommentsForPost(postId);
    }
    showComments.update(state => ({ ...state, [postId]: !state[postId] }));
  };

  function handleNewComment(event) {
    const { postId, insertedComment } = event.detail;
    comments.update(commentsState => updateCommentTree(commentsState, postId, insertedComment));
  }

  function handleDeleteComment(event) {
    const { commentId, postId, parentId } = event.detail;
    deleteComment(commentId, postId, parentId);
  }

  onMount(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (session) {
      user.set(session.user);
    } else if (error) {
      console.error('Error retrieving session:', error.message);
    }

    fetchPosts();
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    user.set(session?.user ?? null);
  });

  const handleRefreshPosts = () => {
    fetchPosts();
  };
</script>

<main>
  <div class="header">
    <h1>4Kino</h1>
    {#if $user}
      <button class="button" on:click={async () => { await supabase.auth.signOut(); user.set(null); window.location.href = '/'; }}>Log Out</button>
    {/if}
  </div>

  {#if $user}
    <div class="post-creation-box">
      <form on:submit|preventDefault={submitPost}>
        <textarea
        bind:value={$text}
        placeholder="What's on your mind?"
        on:input={(e) => autoResizeTextarea(e.target)}
      ></textarea>
      <div class="icon-container">
        <input type="file" id="post-image" accept="image/*" style="display: none;" />
        <label for="post-image" class="upload-button">
          <i class="fas fa-camera"></i>
        </label>
        <button class="submit-button" type="submit">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    </form>
      {#if $error}
        <p style="color: red;">{$error}</p>
      {/if}
    </div>
  {:else}
    <p>Please log in to submit a post.</p>
  {/if}

  <section>
    <h2>Posts</h2>
    {#if $posts.length === 0}
      <p>No posts yet.</p>
    {:else}
      {#each $posts as post}
        <div class="post-box">
          <div class="post-header">
            <p><strong>{post.username}</strong></p>
            <div class="post-details">
              <p class="post-date">{new Date(post.created_at).toLocaleString()}</p>
              {#if $user && post.user_id === $user.id}
              <button class="delete-button" on:click={() => deletePost(post.id)}>
                <i class="fas fa-trash-alt"></i>
              </button>
              {/if}
            </div>
          </div>
          <p class="post-content">{post.content}</p>
          {#if post.file_url}
            <img src={post.file_url} alt="Post image" class="post-image" />
          {/if}
          <div class="thumbs-container">
            <button class="thumbs-button" on:click={() => updateInteraction(post.id, 'like')}>
              <i class="fas fa-thumbs-up"></i> {post.thumbs_up}
            </button>
            <button class="thumbs-button" on:click={() => updateInteraction(post.id, 'dislike')}>
              <i class="fas fa-thumbs-down"></i> {post.thumbs_down}
            </button>
            {#if $user}
              <button class="thumbs-button" on:click={() => toggleCommentsVisibility(post.id)}>
                <i class="fas fa-comments"></i> {post.comments_count}
              </button>
              <button class="thumbs-button" on:click={() => toggleCommentBox(post.id)}>
                <i class="fas fa-comment-alt"></i>
              </button>
            {/if}
          </div>
          {#if $user && $showCommentBox[post.id]}
            <form on:submit|preventDefault={() => submitComment(post.id, $newComment[post.id], null)}
                  on:input={(e) => autoResizeTextarea(e.target)}>
              <textarea bind:value={$newComment[post.id]} placeholder="Add a comment..."></textarea>
              <button class="comment-submit-button" type="submit"><i class="fas fa-arrow-up"></i></button>
            </form>
          {/if}
          {#if $showComments[post.id]}
            {#if $commentsLoading[post.id]}
              <p>Loading comments...</p>
            {:else}
              {#each $comments[post.id] ?? [] as comment (comment.id)}
                <CommentComponent
                  comment={comment}
                  postId={post.id}
                  {comments}
                  {showCommentBox}
                  {newComment}
                  {user}
                  on:newComment={handleNewComment}
                  on:deleteComment={handleDeleteComment}
                />
              {/each}
            {/if}
          {/if}
        </div>
      {/each}
    {/if}
  </section>
  
</main>


<style>
  html, body {
    background-color: black;
    color: white;
    font-family: 'Poppins', sans-serif;
    margin: 0;
    padding: 0;
  }

  main {
    padding: 1em;
    max-width: 600px;
    margin: 0 auto;
    background-color: black;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5em;
    color: white;
  }

  textarea {
    width: 100%;
    height: 50px;
    resize: none;
    border: 1px solid #ddd;
    border-radius: 10px;
    margin-top: 0.5em;
    padding: 10px;
    background-color: black;
    color: white;
  }

  .post-box {
    border: 1px solid #ccc;
    border-radius: 15px;
    padding: 1em;
    margin-bottom: 1em;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    background-color: #1c1c1c; /* Slightly lighter than black for contrast */
  }

  .post-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.2em;
    color: white;
  }

  .post-details {
    display: flex;
    align-items: center;
    color: white;
  }

  .post-date {
    margin-right: 0.5em;
    font-size: 0.9em;
    color: gray;
  }

  .delete-button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2em;
    color: white;
    transition: color 0.3s ease;
  }

  .delete-button:hover {
    color:grey;
  }

  .post-content {
    margin: 0.2em 0;
    overflow-wrap: break-word; /* Adds compatibility for different browsers */
    white-space: pre-wrap; /* Preserves whitespace and wraps text */
    margin-bottom: 1em;
    color: white;
  }

  .thumbs-container {
    display: flex;
    justify-content: flex-start;
    gap: 1em;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    border-top: 1px solid #eee;
  }

  .thumbs-button {
    background: none;
    border: none;
    font-size: 1.2em;
    margin-top: 0.5em;
    cursor: pointer;
    color: white;
    transition: color 0.3s ease;
  }

  .thumbs-button:hover {
    color:grey;
  }

  .comments {
    margin-top: 1em;
  }

  .comment {
    border-left: 1px solid #ccc;
    margin-left: 1em;
    padding-left: 1em;
    margin-bottom: 1em; /* Add spacing between comments */
    overflow-wrap: break-word; /* Adds compatibility for different browsers */
    color: white;
    background-color: #1c1c1c; /* Slightly lighter than black for contrast */
  }

  .comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25em; /* Adjust the spacing */
    color: white;
  }

  .comment-details {
    display: flex;
    align-items: center;
    color: white;
  }

  .comment-date {
    margin-right: 0.5em;
    font-size: 0.9em;
    color: gray;
  }

  .reply-button {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    margin-left: auto;
    transition: color 0.3s ease;
    text-align: right
  }

  .reply-button:hover {
    color:grey;
  }

  .comment-form {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }

  .comment-textarea {
    width: 100%;
    height: 50px;
    resize: none;
    border: 1px solid #ddd;
    border-radius: 10px;
    margin-top: 0.5em;
    padding: 10px;
    background-color: black;
    color: white;
  }

  .comment {
    border: 1px solid #ddd;
    border-radius: 10px;
    padding: 0.5em;
    background-color: #1c1c1c;
  }

  .comment .comment {
    margin-left: 1em;
  }

  .comments-box {
    margin-top: 1em;
  }

  .post-creation-box {
    border: 1px solid #ccc;
    border-radius: 15px;
    padding: 1em;
    margin-bottom: 1em;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    background-color: #1c1c1c;
    color: white;
  }

  .button {
    background-color: black;
    color: white;
    border: none;
    padding: 0.5em 1em;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1em;
    transition: background-color 0.3s ease;
  }

  .button:hover {
    background-color: grey;
  }

  .button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }

  .comment-submit-button {
    margin-top: 0.5em;
    background: none;
    border: none;
    font-size: 1.2em;
    cursor: pointer;
    color: white;
    transition: color 0.3s ease;
  }

  .comment-submit-button:hover {
    color:grey;
  }

  .header,
  .post-box,
  .comments-box,
  .post-creation-box,
  .button,
  textarea {
    font-family: 'Poppins', sans-serif;
  }

  p, h2 {
    font-family: 'Poppins', sans-serif;
    margin: 0.5em 0;
    font-size: 1em;
    color: white;
  }

  .submit-button {
    margin-top: 1em;
    background: none;
    border: none;
    font-size: 1.5em;
    cursor: pointer;
    color: white;
    transition: color 0.3s ease;
    text-align: right
  }

  .submit-button:hover {
    color:grey;
  }

  .post-image {
    border: 1px solid #ccc;
    border-radius: 15px;
  }

  .post-image {
    max-width: 100%;
    height: auto;
    margin-top: 10px;
    border-radius: 10px;
  }

  .upload-button {
    display: inline-block;
    color: white;
    padding: 0.5em;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.5em;
    transition: color 0.3s ease;
    margin-top: 0.5em;
    position: relative;
    top: 5px; /* Adjust this value to move the camera icon lower */
  }

  .upload-button:hover {
    color: grey;
  }

  .upload-button i {
    pointer-events: none;
  }

  .icon-container {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
  }

  p {
    color: white;
  }
</style>



