/**
 * TrashDrop Admin Dashboard - Bin Management
 * Handles QR code generation, bag management, and tracking
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Bin Management functionality
    BinManagementService.init();
});

const BinManagementService = {
    init: function() {
        // Set up event listeners for tab navigation
        this.setupTabNavigation();
        
        // Set up event listeners for the Generate Bag form
        this.setupGenerateBagForm();
        
        // Set up event listeners for modals
        this.setupModalEventListeners();
        
        // Initialize filters
        this.setupFilters();
    },
    
    setupTabNavigation: function() {
        const tabLinks = document.querySelectorAll('[data-tab]');
        
        tabLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Remove active class from all tabs
                tabLinks.forEach(tab => {
                    tab.classList.remove('active', 'text-blue-600', 'border-blue-600');
                    tab.classList.add('text-gray-500', 'border-transparent');
                });
                
                // Add active class to clicked tab
                this.classList.add('active', 'text-blue-600', 'border-blue-600');
                this.classList.remove('text-gray-500', 'border-transparent');
                
                // Hide all tab panes
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.add('hidden');
                    pane.classList.remove('active');
                });
                
                // Show the selected tab pane
                const targetTab = this.getAttribute('data-tab');
                const targetPane = document.getElementById(targetTab + '-content');
                
                if (targetPane) {
                    targetPane.classList.remove('hidden');
                    targetPane.classList.add('active');
                }
            });
        });
    },
    
    setupGenerateBagForm: function() {
        const trashTypeSelect = document.getElementById('trash-type');
        const bagSizeSelect = document.getElementById('bag-size');
        const generateBtn = document.getElementById('generate-batch-btn');
        const downloadBtn = document.getElementById('download-qr-btn');
        
        // Update QR preview when selections change
        const updateQRPreview = () => {
            const trashType = trashTypeSelect.value;
            const bagSize = bagSizeSelect.value;
            const previewLabel = document.getElementById('qr-preview-label');
            const encodedData = document.getElementById('encoded-data');
            const qrPreview = document.getElementById('qr-preview');
            
            let trashTypeText = 'Green - Organic';
            if (trashType === 'blue') trashTypeText = 'Blue - Recyclable';
            if (trashType === 'red') trashTypeText = 'Red - Hazardous';
            
            let bagSizeText = 'Small';
            if (bagSize === 'medium') bagSizeText = 'Medium';
            if (bagSize === 'large') bagSizeText = 'Large';
            
            previewLabel.textContent = `${trashTypeText} - ${bagSizeText}`;
            
            const encodedString = `Sample:${trashTypeText}-${bagSizeText}`;
            encodedData.textContent = encodedString;
            
            // Update QR code image
            qrPreview.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(encodedString)}" alt="QR Code" class="max-w-full">`;
        };
        
        trashTypeSelect.addEventListener('change', updateQRPreview);
        bagSizeSelect.addEventListener('change', updateQRPreview);
        
        // Generate batch button click handler
        generateBtn.addEventListener('click', function() {
            const bagsCount = document.getElementById('bags-count').value;
            const batchesCount = document.getElementById('batches-count').value;
            
            // Generate a random batch ID
            const batchId = '#B' + Math.floor(1000 + Math.random() * 9000);
            document.getElementById('batch-id').textContent = batchId;
            
            // Show success message
            const successMsg = document.getElementById('generation-success');
            successMsg.classList.remove('hidden');
            
            // Enable download button
            downloadBtn.disabled = false;
            downloadBtn.classList.remove('bg-gray-200', 'text-gray-700');
            downloadBtn.classList.add('bg-green-600', 'text-white');
            
            // Add to recent batches table
            this.addToRecentBatches(batchId, trashTypeSelect.value, bagSizeSelect.value, bagsCount);
            
            // Hide success message after 3 seconds
            setTimeout(() => {
                successMsg.classList.add('hidden');
            }, 3000);
        });
        
        // Download QR codes button click handler
        downloadBtn.addEventListener('click', function() {
            alert('QR codes would be downloaded as a PDF in a real implementation.');
        });
    },
    
    addToRecentBatches: function(batchId, trashType, bagSize, bagsCount) {
        const table = document.getElementById('recent-batches-table');
        const now = new Date();
        const dateStr = now.getFullYear() + '-' + 
                        String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(now.getDate()).padStart(2, '0') + ' ' +
                        String(now.getHours()).padStart(2, '0') + ':' +
                        String(now.getMinutes()).padStart(2, '0') + ':' +
                        String(now.getSeconds()).padStart(2, '0');
        
        let trashTypeText = 'Green - Organic';
        let trashTypeClass = 'green';
        if (trashType === 'blue') {
            trashTypeText = 'Blue - Recyclable';
            trashTypeClass = 'blue';
        }
        if (trashType === 'red') {
            trashTypeText = 'Red - Hazardous';
            trashTypeClass = 'red';
        }
        
        let bagSizeText = 'Small';
        if (bagSize === 'medium') bagSizeText = 'Medium';
        if (bagSize === 'large') bagSizeText = 'Large';
        
        const newRow = document.createElement('tr');
        newRow.className = 'border-b border-gray-100 hover:bg-gray-50';
        newRow.innerHTML = `
            <td class="px-4 py-3 text-sm font-medium">${batchId}</td>
            <td class="px-4 py-3">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${trashTypeClass}-100 text-${trashTypeClass}-800">
                    <span class="w-2 h-2 rounded-full bg-${trashTypeClass}-500 mr-1"></span>
                    ${trashTypeText}
                </span>
            </td>
            <td class="px-4 py-3 text-sm">${bagSizeText}</td>
            <td class="px-4 py-3 text-sm">${bagsCount}</td>
            <td class="px-4 py-3 text-sm">${dateStr}</td>
            <td class="px-4 py-3">
                <div class="flex space-x-2">
                    <button class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-eye" title="View QR Codes"></i>
                    </button>
                    <button class="text-green-600 hover:text-green-800">
                        <i class="fas fa-download" title="Download QR Codes"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Insert at the beginning of the table
        if (table.firstChild) {
            table.insertBefore(newRow, table.firstChild);
        } else {
            table.appendChild(newRow);
        }
    },
    
    setupModalEventListeners: function() {
        // QR Code Modal
        const viewQRButtons = document.querySelectorAll('.fa-eye');
        const qrModal = document.getElementById('qr-code-modal');
        const closeQRModal = document.getElementById('close-qr-modal');
        
        viewQRButtons.forEach(button => {
            button.addEventListener('click', function() {
                qrModal.classList.remove('hidden');
            });
        });
        
        if (closeQRModal) {
            closeQRModal.addEventListener('click', function() {
                qrModal.classList.add('hidden');
            });
        }
        
        // Scan History Modal
        const viewHistoryButtons = document.querySelectorAll('.fa-history');
        const scanHistoryModal = document.getElementById('scan-history-modal');
        const closeScanHistoryModal = document.getElementById('close-scan-history-modal');
        
        viewHistoryButtons.forEach(button => {
            button.addEventListener('click', function() {
                scanHistoryModal.classList.remove('hidden');
            });
        });
        
        if (closeScanHistoryModal) {
            closeScanHistoryModal.addEventListener('click', function() {
                scanHistoryModal.classList.add('hidden');
            });
        }
    },
    
    setupFilters: function() {
        // Status filter
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', function() {
                // In a real implementation, this would filter the table
                console.log('Status filter changed to:', this.value);
            });
        }
        
        // Scan filter
        const scanFilter = document.getElementById('scan-filter');
        if (scanFilter) {
            scanFilter.addEventListener('change', function() {
                // In a real implementation, this would filter the table
                console.log('Scan filter changed to:', this.value);
            });
        }
        
        // Generation date filter
        const dateFilter = document.getElementById('generation-date-filter');
        if (dateFilter) {
            dateFilter.addEventListener('change', function() {
                // In a real implementation, this would filter the table
                console.log('Date filter changed to:', this.value);
            });
        }
        
        // History scan filter
        const historyScanFilter = document.getElementById('history-scan-filter');
        if (historyScanFilter) {
            historyScanFilter.addEventListener('change', function() {
                // In a real implementation, this would filter the table
                console.log('History scan filter changed to:', this.value);
            });
        }
    }
};
