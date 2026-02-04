import { store } from './store.js';

export function initDragAndDrop(renderCallback) {
    let draggedItem = null;
    let placeholder = null;

    const container = document.getElementById('task-list');

    // Helper to get task ID from element
    const getTaskId = (el) => el.getAttribute('data-task-id');

    container.addEventListener('dragstart', (e) => {
        const taskItem = e.target.closest('li');
        if (!taskItem) return;

        draggedItem = taskItem;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', getTaskId(taskItem));

        // Visual feedback
        setTimeout(() => taskItem.classList.add('opacity-50'), 0);
    });

    container.addEventListener('dragend', (e) => {
        if (draggedItem) {
            draggedItem.classList.remove('opacity-50');
            draggedItem = null;
        }
        if (placeholder && placeholder.parentNode) {
            placeholder.parentNode.removeChild(placeholder);
            placeholder = null;
        }
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const taskItem = e.target.closest('li');
        if (!taskItem || taskItem === draggedItem) return;

        const bounding = taskItem.getBoundingClientRect();
        const offset = bounding.y + (bounding.height / 2);

        // Insert placeholder logic
        if (!placeholder) {
            placeholder = document.createElement('li');
            placeholder.className = 'h-12 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300';
        }

        if (e.clientY - offset > 0) {
            taskItem.after(placeholder);
        } else {
            taskItem.before(placeholder);
        }
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        // Since we are not strictly persisting "order" in the array indices in store yet (it's just array order),
        // we need to reorder the array in the store based on DOM position.

        // Ideally, we move the item in the DOM, then update state.
        if (draggedItem && placeholder) {
            placeholder.replaceWith(draggedItem);

            // Re-sync store order based on DOM
            // This is a simple approach: get all IDs from DOM and re-sort store state
            const allIds = Array.from(container.children).map(li => li.getAttribute('data-task-id')).filter(id => id);

            // We need to keep the integrity of tasks that are NOT in the current view (if filtering)
            // But here we might be viewing "All" or a specific list.
            // For simplicity in this iteration: We won't reorder global state complexly. 
            // We will just let the DOM be updated for now as a visual cue until we implement robust reorder in Store.
            // Update: Let's do a simple reorder in memory for the *current list view*

            // For now, Drag & Drop is visual. 
            // To make it persistent, we would implement `store.reorderTasks(currentListId, allIds)`.
            // Given the complexity of "Smart Lists", reordering is best supported in "Custom Lists".
        }
    });

    // Sidebar Drop (Move to another list)
    const sidebarLists = document.querySelectorAll('#custom-lists-nav a, #smart-lists-nav a');
    // Note: Since these are dynamic, we should delegate or re-attach. 
    // Ideally app.js calls this init after rendering sidebar.
}

export function setupSidebarDrop(listId, element) {
    element.addEventListener('dragover', e => {
        e.preventDefault();
        element.classList.add('bg-indigo-50');
    });

    element.addEventListener('dragleave', e => {
        element.classList.remove('bg-indigo-50');
    });

    element.addEventListener('drop', e => {
        e.preventDefault();
        element.classList.remove('bg-indigo-50');
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) {
            store.updateTask(taskId, { listId: listId }); // For smart lists this might need logic check
            // If dropped on "Today" smart list? -> update dueDate? 
            // For simplicity, we handle ID based lists primarily.
        }
    });
}
