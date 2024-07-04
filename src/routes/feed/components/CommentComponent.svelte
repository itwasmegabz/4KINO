<script>
  import { createEventDispatcher } from 'svelte';
  import { supabase } from '../../../lib/supabaseClient';
  import { get } from 'svelte/store';
  import CommentComponent from './CommentComponent.svelte';
  import { writable } from 'svelte/store';

  export let comment;
  export let postId;
  export let comments;
  export let showCommentBox;
  export let newComment;
  export let user;

  // Auto-resize function for textarea
  const autoResizeTextarea = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const showReplies = writable({});
  const dispatch = createEventDispatcher();
  let interactionLoading = false;

  const addCommentToTree = (comments, newComment) => {
    const map = {};
    comments.forEach(comment => {
      map[comment.id] = comment;
    });
    if (newComment.parent_id === null) {
      comments.push(newComment);
    } else if (map[newComment.parent_id]) {
      map[newComment.parent_id].children = map[newComment.parent_id].children || [];
      map[newComment.parent_id].children.push(newComment);
      map[newComment.parent_id].replies_count = map[newComment.parent_id].replies_count || 0;
      map[newComment.parent_id].replies_count += 1; // Increment replies count
    }
  };

  const updateCommentTree = (commentsState, postId, insertedComment) => {
    const postComments = commentsState[postId] || [];
    addCommentToTree(postComments, insertedComment);
    commentsState[postId] = postComments;
    return commentsState;
  };

  const deleteComment = async (commentId, parentId) => {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      return;
    }

    comments.update(commentsState => {
      const updatedState = deleteCommentFromTree(commentsState, postId, commentId, parentId);
      return updatedState;
    });

    dispatch('deleteComment', { commentId, postId, parentId });
  };

  const deleteCommentFromTree = (commentsState, postId, commentId, parentId) => {
    const postComments = commentsState[postId] || [];

    const recursiveDelete = (comments, commentId) => {
      for (let i = comments.length - 1; i >= 0; i--) {
        if (comments[i].id === commentId) {
          comments.splice(i, 1);
          break;
        } else if (comments[i].children) {
          recursiveDelete(comments[i].children, commentId);
        }
      }
    };

    recursiveDelete(postComments, commentId);

    if (parentId) {
      const parentComment = postComments.find(comment => comment.id === parentId);
      if (parentComment) {
        parentComment.replies_count = parentComment.replies_count || 0;
        parentComment.replies_count -= 1; // Decrement replies count
      }
    }

    commentsState[postId] = postComments;
    return commentsState;
  };

  const submitComment = async (postId, content, parentId = null) => {
    const currentUser = get(user);

    if (!currentUser) {
      console.error('You must be logged in to submit a comment');
      return;
    }

    if (content.trim() === '') {
      console.error('Comment content cannot be empty');
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
      console.error('Error inserting comment:', insertError.message);
      return;
    }

    comments.update(commentsState => {
      const updatedState = updateCommentTree(commentsState, postId, insertedComment);
      return updatedState;
    });

    newComment.update(state => ({ ...state, [parentId || postId]: '' }));

    dispatch('newComment', { postId, insertedComment });

    if (parentId) {
      comments.update(commentsState => {
        const postComments = commentsState[postId] || [];
        const parentComment = postComments.find(comment => comment.id === parentId);
        if (parentComment) {
          parentComment.replies_count = parentComment.replies_count || 0;
          parentComment.replies_count += 1; // Increment replies count
        }
        commentsState[postId] = postComments;
        return commentsState;
      });

      // Display the replies for the parent comment automatically
      showReplies.update(state => ({ ...state, [parentId]: true }));
    }
  };

  const updateInteraction = async (commentId, type) => {
    if (interactionLoading) return; // Prevent further clicks if already loading
    interactionLoading = true;

    const currentUser = get(user);
    if (!currentUser) {
      console.error('You must be logged in to interact');
      interactionLoading = false;
      return;
    }

    const { data: existingInteraction, error: fetchInteractionError } = await supabase
      .from('comment_interactions')
      .select('id, interaction_type')
      .eq('comment_id', commentId)
      .eq('user_id', currentUser.id)
      .single();

    if (fetchInteractionError && fetchInteractionError.code !== 'PGRST116') {
      console.error('Error fetching interaction:', fetchInteractionError);
      interactionLoading = false;
      return;
    }

    if (existingInteraction) {
      if (existingInteraction.interaction_type === type) {
        const { error: deleteError } = await supabase
          .from('comment_interactions')
          .delete()
          .eq('id', existingInteraction.id);

        if (deleteError) {
          console.error('Error deleting interaction:', deleteError);
          interactionLoading = false;
          return;
        }

        comments.update(commentsState => {
          const updatedState = updateInteractionInTree(commentsState, commentId, type, false);
          return updatedState;
        });
      } else {
        const { error: updateInteractionError } = await supabase
          .from('comment_interactions')
          .update({ interaction_type: type })
          .eq('id', existingInteraction.id);

        if (updateInteractionError) {
          console.error('Error updating interaction:', updateInteractionError);
          interactionLoading = false;
          return;
        }

        comments.update(commentsState => {
          const updatedState = switchInteractionInTree(commentsState, commentId, existingInteraction.interaction_type, type);
          return updatedState;
        });
      }
    } else {
      const { data: insertedInteraction, error: insertError } = await supabase
        .from('comment_interactions')
        .insert([{ comment_id: commentId, user_id: currentUser.id, interaction_type: type }])
        .select('id, interaction_type, created_at')
        .single();

      if (insertError) {
        console.error('Error inserting interaction:', insertError);
        interactionLoading = false;
        return;
      }

      comments.update(commentsState => {
        const updatedState = updateInteractionInTree(commentsState, commentId, type, true);
        return updatedState;
      });
    }

    interactionLoading = false;
  };

  const updateInteractionInTree = (commentsState, commentId, type, isAdding) => {
    const recursiveUpdate = (comments, commentId, type, isAdding) => {
      for (let i = comments.length - 1; i >= 0; i--) {
        if (comments[i].id === commentId) {
          if (type === 'like') {
            comments[i].thumbs_up += isAdding ? 1 : -1;
          } else {
            comments[i].thumbs_down += isAdding ? 1 : -1;
          }
          break;
        } else if (comments[i].children) {
          recursiveUpdate(comments[i].children, commentId, type, isAdding);
        }
      }
    };

    recursiveUpdate(commentsState[postId], commentId, type, isAdding);

    return commentsState;
  };

  const switchInteractionInTree = (commentsState, commentId, oldType, newType) => {
    const recursiveSwitch = (comments, commentId, oldType, newType) => {
      for (let i = comments.length - 1; i >= 0; i--) {
        if (comments[i].id === commentId) {
          if (oldType === 'like' && newType === 'dislike') {
            comments[i].thumbs_up -= 1;
            comments[i].thumbs_down += 1;
          } else if (oldType === 'dislike' && newType === 'like') {
            comments[i].thumbs_down -= 1;
            comments[i].thumbs_up += 1;
          }
          break;
        } else if (comments[i].children) {
          recursiveSwitch(comments[i].children, commentId, oldType, newType);
        }
      }
    };

    recursiveSwitch(commentsState[postId], commentId, oldType, newType);

    return commentsState;
  };

  const toggleCommentBox = (commentId) => {
    showCommentBox.update(state => ({ ...state, [commentId]: !state[commentId] }));
  };

  function handleNewComment(event) {
    const { postId, insertedComment } = event.detail;
    comments.update(commentsState => updateCommentTree(commentsState, postId, insertedComment));
  }

  const toggleRepliesVisibility = (commentId) => {
    showReplies.update(state => ({ ...state, [commentId]: !state[commentId] }));
  };
</script>

<div class="comment">
  <div class="comment-header">
    <p><strong>{comment.profiles?.username || 'Unknown'}</strong></p>
    <div class="comment-details">
      <p class="comment-date">{new Date(comment.created_at).toLocaleString()}</p>
      {#if $user && comment.user_id === $user.id}
        <button class="delete-button" on:click={() => deleteComment(comment.id, comment.parent_id)}>
          <i class="fas fa-trash-alt"></i>
        </button>
      {/if}
    </div>
  </div>
  <p>{comment.content}</p>
  <div class="thumbs-container">
    <button class="thumbs-button" on:click={() => updateInteraction(comment.id, 'like')} disabled={interactionLoading}>
      <i class="fas fa-thumbs-up"></i> {comment.thumbs_up}
    </button>
    <button class="thumbs-button" on:click={() => updateInteraction(comment.id, 'dislike')} disabled={interactionLoading}>
      <i class="fas fa-thumbs-down"></i> {comment.thumbs_down}
    </button>
    {#if $user}
      <button class="thumbs-button" on:click={() => toggleRepliesVisibility(comment.id)}>
        <i class="fas fa-reply"></i> {comment.replies_count ?? 0}
      </button>
      <button class="thumbs-button" on:click={() => toggleCommentBox(comment.id)}>
        <i class="fas fa-comment-alt"></i>
      </button>
    {/if}
  </div>

  {#if $user && $showCommentBox[comment.id]}
    <form on:submit|preventDefault={() => submitComment(postId, newComment[comment.id], comment.id)}>
      <textarea
        bind:value={newComment[comment.id]}
        placeholder="Add a reply..."
        on:input={(e) => autoResizeTextarea(e.target)}
      ></textarea>
      <button class="thumbs-button" type="submit">
        <i class="fas fa-arrow-up"></i>
      </button>
    </form>
  {/if}

  {#if $showReplies[comment.id] || comment.user_id === $user.id}
    {#each comment.children ?? [] as childComment (childComment.id)}
      <CommentComponent comment={childComment} postId={postId} {comments} {showCommentBox} {newComment} {user} on:newComment={handleNewComment} />
    {/each}
  {/if}
</div>

<style>
  .comment {
    border-left: 1px solid #ccc;
    margin-left: 1em;
    padding-left: 1em;
    margin-bottom: 1em; /* Add spacing between comments */
    overflow-wrap: break-word; /* Adds compatibility for different browsers */
    background-color: #1c1c1c; /* Slightly lighter than black for contrast */
    color: white;
  }

  textarea {
    width: 100%;
    height: 50px;
    resize: none; /* Prevent resizing of the main post textarea */
    border: 1px solid #ddd;
    border-radius: 10px; /* Adjust the radius to your liking */
    overflow: hidden; /* Hide the scrollbar */
    padding: 10px; /* Add padding for the placeholder text */
    background-color: black;
    color: white;
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

  .delete-button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2em;
    color: white;
    transition: color 0.3s ease;
  }

  .delete-button:hover {
    color: grey;
  }

  .thumbs-container {
    display: flex;
    justify-content: flex-start;
    gap: 0.5em; /* Adjust the spacing */
    margin-top: 0.25em; /* Adjust the spacing */
    margin-bottom: 1em;
  }

  .thumbs-button {
    background: none;
    border: none;
    font-size: 1.2em;
    cursor: pointer;
    margin-top: 0.5em;
    color: white;
    transition: color 0.3s ease;
  }

  .thumbs-button:hover {
    color: grey;
  }

  .comment p {
    margin: 0.25em 0; /* Adjust the spacing */
    color: white;
  }
</style>
