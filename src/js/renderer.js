const { ipcRenderer } = require('electron');
const { characters, stages } = require('@slippi/slippi-js');
const { dialog } = require('electron');
const path = require('path');
const { shell } = require('electron');

const { processFiles } = require('./js/stats.js');
const { highlightMatchingColumns } = require('./js/collapsible.js');
const { getSelectedFolderFromLocalStorage } = require('./js/utils.js');

console.log(__dirname); 

// document.getElementById('setPlaybackButton').addEventListener('click', function() {
//     // Trigger the hidden file input click
//     document.getElementById('fileInput').click();
// });

// document.getElementById('fileInput').addEventListener('change', function(event) {
//     // Get the selected file
//     const file = event.target.files[0];
//     if (file) {
//         // Store the file path for later use
//         localStorage.setItem('selectedExePath', file.path);
//         alert(`Selected file: ${file.name}`);
//     } else {
//         alert('No file selected');
//     }
// });

// Event listener for the open folder button
document.getElementById('openFolderButton').addEventListener('click', () => {
    // Check if a folder is selected
    const selectedFolder = getSelectedFolderFromLocalStorage();
    if (!selectedFolder || selectedFolder === null || selectedFolder === "null") {
        alert('Choose a folder first. (Select Folder)');
        return;
    }
    
    // Open the selected folder on the user's machine
    ipcRenderer.send('open-folder', selectedFolder);
});

// Listen for the response from main process to open folder
ipcRenderer.on('folder-opened', (event, message) => {
    console.log(message);
});

document.getElementById('selectFolderButton').addEventListener('click', () => {
    ipcRenderer.send('select-folder-dialog');
});

function saveSelectedFolderToLocalStorage(folderPath) {
    if (folderPath === null) {
        localStorage.removeItem('selectedFolder'); // Remove the key if folderPath is null
    } else {
        localStorage.setItem('selectedFolder', folderPath);
    }
}

// Listen for the selected directory from main process
ipcRenderer.on('selected-directory', (event, folderPath) => {
    console.log('Selected directory:', folderPath);
    saveSelectedFolderToLocalStorage(folderPath);
    updateSelectedFolderText(); // settings modal text update
});

// Event listener for the start button
document.getElementById('startButton').addEventListener('click', processFiles);

// Event listener for the refresh button
document.getElementById('refreshButton').addEventListener('click', () => {
    // Reload the page
    window.location.reload();
});

document.addEventListener('click', function(event) {
    if (event.target.classList.contains('collapsible-header')) {
        const collapsibleBody = event.target.nextElementSibling;
        collapsibleBody.classList.toggle('show');
    }
});

function initializeConnectCodeInput() {
    const connectCodeContainer = document.getElementById('connectCodeContainer');
    const connectCodeInput = document.getElementById('connectCodeInput');

    connectCodeContainer.addEventListener('mouseenter', handleMouseEnter);
    connectCodeContainer.addEventListener('mouseleave', handleMouseLeave);
    connectCodeInput.addEventListener('focus', handleFocus);
    connectCodeInput.addEventListener('blur', handleBlur);
    connectCodeInput.addEventListener('input', highlightMatchingColumns); 
}

function handleMouseEnter() {
    const connectCodeContainer = document.getElementById('connectCodeContainer');
    connectCodeContainer.classList.add('hovered');
}

function handleMouseLeave() {
    const connectCodeContainer = document.getElementById('connectCodeContainer');
    const connectCodeInput = document.getElementById('connectCodeInput');
    if (!connectCodeInput.matches(':focus')) {
        connectCodeContainer.classList.remove('hovered');
    }
}

function handleFocus() {
    const connectCodeContainer = document.getElementById('connectCodeContainer');
    connectCodeContainer.classList.add('hovered');
}

function handleBlur() {
    const connectCodeContainer = document.getElementById('connectCodeContainer');
    if (!connectCodeContainer.matches(':hover')) {
        connectCodeContainer.classList.remove('hovered');
    }
}

function initializeScrollToTopBtn() {
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');

    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            scrollToTopBtn.classList.add('show');
        } else {
            scrollToTopBtn.classList.remove('show');
        }
    });

    scrollToTopBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Add ripple effect by toggling the active class
        scrollToTopBtn.classList.add('active');
        setTimeout(() => {
            scrollToTopBtn.classList.remove('active');
        }, 600); // Match the duration of the ripple animation
    });
}

function initializeHideShortGamesCheckbox() {
    const hideShortGamesCheckbox = document.getElementById('hideShortGamesCheckbox');
    hideShortGamesCheckbox.addEventListener('change', function() {
        hideShortGames();
    });

    // Initial call to apply the hiding logic based on the checkbox state
    hideShortGames();
}

function hideShortGames() {
    let numShortGames = 0;
    const hideShortGamesCheckbox = document.getElementById('hideShortGamesCheckbox');
    const collapsibleSections = document.querySelectorAll('.collapsible');

    collapsibleSections.forEach(section => {
        const gameLength = parseFloat(section.querySelector('.collapsible-header').dataset.gamelength);

        if (hideShortGamesCheckbox.checked) {
            if (gameLength < 30) {
                section.style.display = 'none';
                numShortGames++;
            } else {
                section.style.display = '';
            }
        } else {
            section.style.display = '';
        }
    });
    console.log('numShortGames '+numShortGames)
}

function initializeSettingsModal() {
    var modal = document.getElementById("settingsModal");
    var btn = document.getElementById("settingsButton");
    var span = document.getElementsByClassName("close")[0];

    btn.onclick = function() {
        modal.style.display = "block";
        updateSelectedFolderText(); 
    }

    span.onclick = function() {
        modal.style.display = "none";
    }

    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
}

function updateSelectedFolderText() {
    var selectedFolder = getSelectedFolderFromLocalStorage();
    var selectedFolderText = document.getElementById("selectedFolderText");

    if (selectedFolder && selectedFolder !== "null") {
        selectedFolderText.textContent = "Selected folder: " + selectedFolder;
    } else {
        selectedFolderText.textContent = "Select a folder";
    }
}

document.getElementById('expandCollapseButton').addEventListener('click', function() {
    const collapsibleBodies = document.querySelectorAll('.collapsible-body');
    let allExpanded = true;

    // Check if all collapsibles are already expanded
    collapsibleBodies.forEach(body => {
        if (!body.classList.contains('show')) {
            allExpanded = false;
            return;
        }
    });

    // Expand or collapse all collapsibles based on their current state
    collapsibleBodies.forEach(body => {
        if (!allExpanded) {
            body.classList.add('show');
        } else {
            body.classList.remove('show');
        }
    });
});

function displayProcessingOptions() {
    // const fileCountSelect = document.querySelector('input[name="fileCount"]:checked');
    // const fileOrderSelect = document.querySelector('input[name="fileOrder"]:checked');
    // const selectedFolder = getSelectedFolderFromLocalStorage();
    // const processingOptionsText = document.getElementById('processingOptionsText');

    // // Display selected folder or prompt to select folder if none is selected
    // if (selectedFolder) {
    //     processingOptionsText.textContent = `Process ${fileCountSelect.value} ${fileCountSelect.value === 'ALL' ? '' : fileOrderSelect.value} files in the directory (${selectedFolder}).`;
    // } else {
    //     processingOptionsText.textContent = 'Select a folder to process files.';
    // }
}

function sortAndRearrangeCollapsibles(option) {
    // Retrieve the container elements
    const collapsibleContainer = document.getElementById('collapsibleContainer');
    const tableContainer = document.getElementById('tableContainer');

    // Retrieve the DOM elements representing the collapsibles and their tables
    const collapsibles = collapsibleContainer.querySelectorAll('.collapsible-header');

    // Convert NodeList to array for easier manipulation
    const collapsiblesArray = Array.from(collapsibles);

    switch (option) {
        case 'Ascending':
            collapsiblesArray.sort((a, b) => {
                const timestampA = Date.parse(a.getAttribute('data-timestamp'));
                const timestampB = Date.parse(b.getAttribute('data-timestamp'));
                return timestampA - timestampB;
            });
            break;
    
        case 'Descending':
            collapsiblesArray.sort((a, b) => {
                const timestampA = Date.parse(a.getAttribute('data-timestamp'));
                const timestampB = Date.parse(b.getAttribute('data-timestamp'));
                return timestampB - timestampA;
            });
            break;
    
        case 'Longest':
            collapsiblesArray.sort((a, b) => {
                const lengthA = parseInt(a.getAttribute('data-gamelength'), 10);
                const lengthB = parseInt(b.getAttribute('data-gamelength'), 10);
                return lengthB - lengthA;
            });
            break;
    
        case 'Shortest':
            collapsiblesArray.sort((a, b) => {
                const lengthA = parseInt(a.getAttribute('data-gamelength'), 10);
                const lengthB = parseInt(b.getAttribute('data-gamelength'), 10);
                return lengthA - lengthB;
            });
            break;
    
        default:
            console.warn('Unknown sorting option: ', option);
            break;
    }
    
    // Clear the container elements
    collapsibleContainer.innerHTML = '';
    tableContainer.innerHTML = '';

    // Append the sorted collapsibles and tables back to their respective containers
    collapsiblesArray.forEach(collapsible => {
        collapsibleContainer.appendChild(collapsible.parentNode); // Append the parent node to maintain the collapsible structure
    });
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM content loaded");

    // Display processing options when the page is loaded
    // displayProcessingOptions();

    const allFilesRadio = document.getElementById('allFiles');
    const customFilesRadio = document.getElementById('customFiles');
    const customFileCountInput = document.getElementById('customFileCount');
    const fileCountSelect = document.querySelector('input[name="fileCount"]:checked');
    const fileOrderSelect = document.querySelector('input[name="fileOrder"]:checked');
    const decrementBtn = document.querySelector('.decrement-btn');
    const incrementBtn = document.querySelector('.increment-btn');

    // Event listener for radio button change
    allFilesRadio.addEventListener('change', function() {
        console.log("ALL radio button clicked");
        customFileCountInput.style.display = 'none';
        customFileCountInput.value = ''; // Clear the value
        decrementBtn.style.display = 'none';
        incrementBtn.style.display = 'none';
        // displayProcessingOptions(); // Update processing options
    });
    
    customFilesRadio.addEventListener('change', function() {
        customFileCountInput.style.display = 'inline-block';
        customFileCountInput.focus();
        decrementBtn.style.display = 'inline-block';
        incrementBtn.style.display = 'inline-block';
    });

    decrementBtn.addEventListener('click', function() {
        if (customFileCountInput.value > 0) {
            customFileCountInput.value--;
        }
    });

    incrementBtn.addEventListener('click', function() {
        customFileCountInput.value++;
    });

    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const dateError = document.getElementById('dateError');

    // Function to validate the end date
    function validateEndDate() {
        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);
        if (endDate < startDate) {
            dateError.style.display = 'block';
            endDateInput.value = ''; // Clear the end date input
            return false;
        } else {
            dateError.style.display = 'none';
            return true;
        }
    }

    // Event listener for end date input change
    endDateInput.addEventListener('change', validateEndDate);

    // Add event listeners to sorting options
    document.getElementById('mostRecentOption').addEventListener('click', function() {
        sortAndRearrangeCollapsibles('Descending');
        document.getElementById('sortDropdown').classList.remove('show');
    });

    document.getElementById('leastRecentOption').addEventListener('click', function() {
        sortAndRearrangeCollapsibles('Ascending');
        document.getElementById('sortDropdown').classList.remove('show');
    });

    document.getElementById('longestOption').addEventListener('click', function() {
        sortAndRearrangeCollapsibles('Longest');
        document.getElementById('sortDropdown').classList.remove('show');
    });

    document.getElementById('shortestOption').addEventListener('click', function() {
        sortAndRearrangeCollapsibles('Shortest');
        document.getElementById('sortDropdown').classList.remove('show');
    });

    initializeConnectCodeInput();
    initializeScrollToTopBtn();
    initializeHideShortGamesCheckbox();
    initializeSettingsModal();

    const accordionHeader = document.getElementById("accordionHeader");
    const accordionContent = document.getElementById("accordionContent");

    accordionHeader.addEventListener("click", function () {
        this.classList.toggle("active");

        if (this.classList.contains("active")) {
            accordionContent.style.maxHeight = accordionContent.scrollHeight + "px";
        } else {
            accordionContent.style.maxHeight = 0;
        }
    });

    const aboutModal = document.getElementById('about-modal');
    const closeButton = document.querySelector('.close');

    let scrollPosition = 0; // Variable to store scroll position

    // Show the modal when the link is clicked
    document.getElementById('about-link-text').addEventListener('click', function() {
        scrollPosition = window.pageYOffset || document.documentElement.scrollTop; // Store current scroll position
        aboutModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent scrolling of the background content
    });

    // Close the modal when the close button is clicked
    closeButton.addEventListener('click', function() {
        aboutModal.style.display = 'none';
        document.body.style.overflow = ''; // Allow scrolling of the background content
        window.scrollTo(0, scrollPosition); // Restore scroll position
    });

    // Close the modal when the user clicks outside of it
    window.addEventListener('click', function(event) {
        if (event.target == aboutModal) {
            aboutModal.style.display = 'none';
            document.body.style.overflow = ''; // Allow scrolling of the background content
            window.scrollTo(0, scrollPosition); // Restore scroll position
        }
    });

    const links = document.querySelectorAll('a.external-link');
    links.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const url = event.target.href;
            shell.openExternal(url);
        });
    });

    const twitterLink = document.getElementById('twitter-link');

    twitterLink.addEventListener('contextmenu', function(event) {
        event.preventDefault(); // Prevent the default right-click menu
        navigator.clipboard.writeText(this.href); // Copy the link to the clipboard
        alert('Twitter link copied!\n https://twitter.com/buddyboom_');
    });
});
