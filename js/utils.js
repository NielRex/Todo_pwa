/**
 * Date Utilities
 * Provides timezone-consistent date handling for cross-platform compatibility
 */

/**
 * Get today's date in YYYY-MM-DD format using local timezone
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getLocalDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get tomorrow's date in YYYY-MM-DD format using local timezone
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getTomorrowDateString() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get yesterday's date in YYYY-MM-DD format using local timezone
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getYesterdayDateString() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format a date for display
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date for display
 */
export function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}
