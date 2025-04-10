/**
 * TrashDrop Admin Dashboard - Data Service
 * Provides centralized data handling and persistence for all dashboard components
 * Includes support for local storage persistence and simulated API calls
 */

const DataService = {
    // Storage keys
    STORAGE_KEYS: {
        REPORTS: 'trashdrop_illegal_dumping_reports',
        BINS: 'trashdrop_bins',
        BATCHES: 'trashdrop_bag_batches',
        USER_SETTINGS: 'trashdrop_user_settings',
        COLLECTORS: 'trashdrop_collectors',
        REQUESTS: 'trashdrop_pickup_requests'
    },
    
    // Initialize the data service
    init: function() {
        console.log('Initializing Data Service');
        
        // Initialize storage if needed
        this.initializeStorage();
        
        // Set up event listeners for storage changes
        window.addEventListener('storage', this.handleStorageChange.bind(this));
        
        return this;
    },
    
    // Initialize storage with default data if empty
    initializeStorage: function() {
        // Check and initialize illegal dumping reports
        if (!localStorage.getItem(this.STORAGE_KEYS.REPORTS)) {
            this.saveReports(this.generateMockReports());
        }
        
        // Check and initialize bins data
        if (!localStorage.getItem(this.STORAGE_KEYS.BINS)) {
            this.saveBins(this.generateMockBins());
        }
        
        // Check and initialize bag batches
        if (!localStorage.getItem(this.STORAGE_KEYS.BATCHES)) {
            this.saveBatches(this.generateMockBatches());
        }
        
        // Check and initialize user settings
        if (!localStorage.getItem(this.STORAGE_KEYS.USER_SETTINGS)) {
            this.saveUserSettings(this.getDefaultUserSettings());
        }
        
        // Check and initialize collectors
        if (!localStorage.getItem(this.STORAGE_KEYS.COLLECTORS)) {
            this.saveCollectors(this.generateMockCollectors());
        }
        
        // Check and initialize pickup requests
        if (!localStorage.getItem(this.STORAGE_KEYS.REQUESTS)) {
            this.savePickupRequests(this.generateMockPickupRequests());
        }
    },
    
    // Handle storage change events (for multi-tab synchronization)
    handleStorageChange: function(event) {
        // Dispatch custom events for components to listen to
        if (event.key === this.STORAGE_KEYS.REPORTS) {
            document.dispatchEvent(new CustomEvent('reports-updated', {
                detail: { reports: JSON.parse(event.newValue) }
            }));
        } else if (event.key === this.STORAGE_KEYS.BINS) {
            document.dispatchEvent(new CustomEvent('bins-updated', {
                detail: { bins: JSON.parse(event.newValue) }
            }));
        } else if (event.key === this.STORAGE_KEYS.BATCHES) {
            document.dispatchEvent(new CustomEvent('batches-updated', {
                detail: { batches: JSON.parse(event.newValue) }
            }));
        } else if (event.key === this.STORAGE_KEYS.USER_SETTINGS) {
            document.dispatchEvent(new CustomEvent('user-settings-updated', {
                detail: { settings: JSON.parse(event.newValue) }
            }));
        } else if (event.key === this.STORAGE_KEYS.COLLECTORS) {
            document.dispatchEvent(new CustomEvent('collectors-updated', {
                detail: { collectors: JSON.parse(event.newValue) }
            }));
        } else if (event.key === this.STORAGE_KEYS.REQUESTS) {
            document.dispatchEvent(new CustomEvent('pickup-requests-updated', {
                detail: { requests: JSON.parse(event.newValue) }
            }));
        }
    },
    
    // ===== ILLEGAL DUMPING REPORTS =====
    
    // Get all illegal dumping reports
    getReports: function() {
        const reports = localStorage.getItem(this.STORAGE_KEYS.REPORTS);
        return reports ? JSON.parse(reports) : [];
    },
    
    // Save all illegal dumping reports
    saveReports: function(reports) {
        localStorage.setItem(this.STORAGE_KEYS.REPORTS, JSON.stringify(reports));
        // Dispatch event for components to update
        document.dispatchEvent(new CustomEvent('reports-updated', {
            detail: { reports: reports }
        }));
        return reports;
    },
    
    // Get a single report by ID
    getReportById: function(reportId) {
        const reports = this.getReports();
        return reports.find(report => report.id === reportId) || null;
    },
    
    // Add a new report
    addReport: function(report) {
        const reports = this.getReports();
        // Generate ID if not provided
        if (!report.id) {
            report.id = 'RPT-' + Date.now().toString().slice(-6);
        }
        // Add timestamp if not provided
        if (!report.timestamp) {
            report.timestamp = new Date().toISOString();
        }
        // Set initial status if not provided
        if (!report.status) {
            report.status = 'new';
        }
        reports.push(report);
        return this.saveReports(reports);
    },
    
    // Update an existing report
    updateReport: function(reportId, updatedData) {
        const reports = this.getReports();
        const index = reports.findIndex(report => report.id === reportId);
        
        if (index !== -1) {
            // Update the report with new data
            reports[index] = { ...reports[index], ...updatedData };
            
            // Add to timeline if status changed
            if (updatedData.status && updatedData.status !== reports[index].status) {
                if (!reports[index].timeline) {
                    reports[index].timeline = [];
                }
                
                reports[index].timeline.push({
                    status: updatedData.status,
                    timestamp: new Date().toISOString(),
                    user: updatedData.user || 'Admin User',
                    notes: updatedData.notes || ''
                });
            }
            
            return this.saveReports(reports);
        }
        
        return null;
    },
    
    // Delete a report
    deleteReport: function(reportId) {
        const reports = this.getReports();
        const filteredReports = reports.filter(report => report.id !== reportId);
        
        if (filteredReports.length < reports.length) {
            return this.saveReports(filteredReports);
        }
        
        return reports;
    },
    
    // Filter reports based on criteria
    filterReports: function(filters) {
        const reports = this.getReports();
        
        return reports.filter(report => {
            let match = true;
            
            // Filter by status
            if (filters.status && filters.status !== 'all') {
                match = match && report.status === filters.status;
            }
            
            // Filter by severity
            if (filters.severity && filters.severity !== 'all') {
                match = match && report.severity === filters.severity;
            }
            
            // Filter by zone/location
            if (filters.zone && filters.zone !== 'all') {
                match = match && report.zone === filters.zone;
            }
            
            // Filter by date range
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                const reportDate = new Date(report.timestamp);
                match = match && reportDate >= startDate;
            }
            
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                const reportDate = new Date(report.timestamp);
                match = match && reportDate <= endDate;
            }
            
            // Filter by search term
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                const searchMatch = 
                    (report.id && report.id.toLowerCase().includes(searchLower)) ||
                    (report.description && report.description.toLowerCase().includes(searchLower)) ||
                    (report.address && report.address.toLowerCase().includes(searchLower)) ||
                    (report.reporter && report.reporter.name && report.reporter.name.toLowerCase().includes(searchLower));
                
                match = match && searchMatch;
            }
            
            return match;
        });
    },
    
    // Generate mock reports for testing
    generateMockReports: function() {
        const mockReports = [];
        const statuses = ['new', 'assigned', 'in_progress', 'completed', 'verified', 'paid'];
        const severities = ['high', 'medium', 'low'];
        const wasteTypes = ['construction', 'household', 'electronic', 'hazardous', 'green_waste'];
        const zones = ['north', 'south', 'east', 'west', 'central'];
        
        for (let i = 1; i <= 50; i++) {
            const reportDate = new Date();
            reportDate.setDate(reportDate.getDate() - Math.floor(Math.random() * 30));
            
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const severity = severities[Math.floor(Math.random() * severities.length)];
            const wasteType = wasteTypes[Math.floor(Math.random() * wasteTypes.length)];
            const zone = zones[Math.floor(Math.random() * zones.length)];
            
            // Generate a timeline based on status
            const timeline = this.generateTimeline(status, reportDate);
            
            mockReports.push({
                id: 'RPT-' + (1000 + i),
                timestamp: reportDate.toISOString(),
                status: status,
                severity: severity,
                wasteType: wasteType,
                volume: Math.floor(Math.random() * 5) + 1 + ' cubic meters',
                description: `Illegal dumping of ${wasteType} waste found near ${zone} district. ${severity === 'high' ? 'Requires immediate attention.' : severity === 'medium' ? 'Should be addressed soon.' : 'Can be scheduled for routine cleanup.'}`,
                location: {
                    address: `${Math.floor(Math.random() * 1000) + 100} ${['Main', 'Oak', 'Pine', 'Maple', 'Cedar'][Math.floor(Math.random() * 5)]} ${['Street', 'Avenue', 'Boulevard', 'Road', 'Lane'][Math.floor(Math.random() * 5)]}, ${zone.charAt(0).toUpperCase() + zone.slice(1)} District`,
                    coordinates: {
                        lat: 40.7128 + (Math.random() * 0.05 - 0.025),
                        lng: -74.0060 + (Math.random() * 0.05 - 0.025)
                    },
                    zone: zone
                },
                reporter: {
                    name: `${['John', 'Jane', 'Michael', 'Emily', 'David'][Math.floor(Math.random() * 5)]} ${['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][Math.floor(Math.random() * 5)]}`,
                    phone: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
                    email: `${['john', 'jane', 'michael', 'emily', 'david'][Math.floor(Math.random() * 5)]}.${['smith', 'johnson', 'williams', 'brown', 'jones'][Math.floor(Math.random() * 5)]}@example.com`
                },
                images: [
                    `/api/placeholder/400/300?text=Dumping+Site+${i}`,
                    `/api/placeholder/400/300?text=Evidence+${i}`
                ],
                timeline: timeline,
                assignment: status !== 'new' ? {
                    assignedTo: `${['Alex', 'Sam', 'Chris', 'Pat', 'Jordan'][Math.floor(Math.random() * 5)]} ${['Garcia', 'Lee', 'Chen', 'Singh', 'Patel'][Math.floor(Math.random() * 5)]}`,
                    assignedAt: timeline.find(event => event.status === 'assigned')?.timestamp || new Date(reportDate.getTime() + 1000 * 60 * 60 * 2).toISOString(),
                    notes: 'Assigned for cleanup.'
                } : null,
                verification: status === 'verified' || status === 'paid' ? {
                    verifiedBy: `${['Morgan', 'Taylor', 'Casey', 'Riley', 'Quinn'][Math.floor(Math.random() * 5)]} ${['Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas'][Math.floor(Math.random() * 5)]}`,
                    verifiedAt: timeline.find(event => event.status === 'verified')?.timestamp || new Date(reportDate.getTime() + 1000 * 60 * 60 * 24 * 2).toISOString(),
                    notes: 'Verified cleanup was completed properly.'
                } : null,
                payment: status === 'paid' ? {
                    amount: Math.floor(Math.random() * 500) + 100,
                    currency: 'USD',
                    processedAt: timeline.find(event => event.status === 'paid')?.timestamp || new Date(reportDate.getTime() + 1000 * 60 * 60 * 24 * 3).toISOString(),
                    paymentMethod: ['Credit Card', 'Bank Transfer', 'Check'][Math.floor(Math.random() * 3)],
                    reference: `PAY-${Math.floor(Math.random() * 10000) + 10000}`
                } : null
            });
        }
        
        return mockReports;
    },
    
    // Generate a timeline based on the report status
    generateTimeline: function(status, reportDate) {
        const timeline = [
            {
                status: 'new',
                timestamp: reportDate.toISOString(),
                user: `${['John', 'Jane', 'Michael', 'Emily', 'David'][Math.floor(Math.random() * 5)]} ${['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][Math.floor(Math.random() * 5)]}`,
                notes: 'Report submitted.'
            }
        ];
        
        // Add assigned event if status is beyond new
        if (['assigned', 'in_progress', 'completed', 'verified', 'paid'].includes(status)) {
            const assignedDate = new Date(reportDate.getTime() + 1000 * 60 * 60 * 2); // 2 hours after report
            timeline.push({
                status: 'assigned',
                timestamp: assignedDate.toISOString(),
                user: 'Admin User',
                notes: 'Assigned to cleanup crew.'
            });
        }
        
        // Add in_progress event if status is beyond assigned
        if (['in_progress', 'completed', 'verified', 'paid'].includes(status)) {
            const inProgressDate = new Date(reportDate.getTime() + 1000 * 60 * 60 * 4); // 4 hours after report
            timeline.push({
                status: 'in_progress',
                timestamp: inProgressDate.toISOString(),
                user: `${['Alex', 'Sam', 'Chris', 'Pat', 'Jordan'][Math.floor(Math.random() * 5)]} ${['Garcia', 'Lee', 'Chen', 'Singh', 'Patel'][Math.floor(Math.random() * 5)]}`,
                notes: 'Cleanup in progress.'
            });
        }
        
        // Add completed event if status is beyond in_progress
        if (['completed', 'verified', 'paid'].includes(status)) {
            const completedDate = new Date(reportDate.getTime() + 1000 * 60 * 60 * 6); // 6 hours after report
            timeline.push({
                status: 'completed',
                timestamp: completedDate.toISOString(),
                user: `${['Alex', 'Sam', 'Chris', 'Pat', 'Jordan'][Math.floor(Math.random() * 5)]} ${['Garcia', 'Lee', 'Chen', 'Singh', 'Patel'][Math.floor(Math.random() * 5)]}`,
                notes: 'Cleanup completed.'
            });
        }
        
        // Add verified event if status is beyond completed
        if (['verified', 'paid'].includes(status)) {
            const verifiedDate = new Date(reportDate.getTime() + 1000 * 60 * 60 * 24); // 1 day after report
            timeline.push({
                status: 'verified',
                timestamp: verifiedDate.toISOString(),
                user: `${['Morgan', 'Taylor', 'Casey', 'Riley', 'Quinn'][Math.floor(Math.random() * 5)]} ${['Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas'][Math.floor(Math.random() * 5)]}`,
                notes: 'Cleanup verified.'
            });
        }
        
        // Add paid event if status is paid
        if (status === 'paid') {
            const paidDate = new Date(reportDate.getTime() + 1000 * 60 * 60 * 24 * 2); // 2 days after report
            timeline.push({
                status: 'paid',
                timestamp: paidDate.toISOString(),
                user: 'Finance Department',
                notes: 'Payment processed.'
            });
        }
        
        return timeline;
    },
    
    // ===== BIN/BAG MANAGEMENT =====
    
    // Get all bins
    getBins: function() {
        const bins = localStorage.getItem(this.STORAGE_KEYS.BINS);
        return bins ? JSON.parse(bins) : [];
    },
    
    // Save all bins
    saveBins: function(bins) {
        localStorage.setItem(this.STORAGE_KEYS.BINS, JSON.stringify(bins));
        // Dispatch event for components to update
        document.dispatchEvent(new CustomEvent('bins-updated', {
            detail: { bins: bins }
        }));
        return bins;
    },
    
    // Get a single bin by ID
    getBinById: function(binId) {
        const bins = this.getBins();
        return bins.find(bin => bin.id === binId) || null;
    },
    
    // Add a new bin
    addBin: function(bin) {
        const bins = this.getBins();
        // Generate ID if not provided
        if (!bin.id) {
            bin.id = 'BIN-' + Date.now().toString().slice(-6);
        }
        // Add timestamp if not provided
        if (!bin.createdAt) {
            bin.createdAt = new Date().toISOString();
        }
        bins.push(bin);
        return this.saveBins(bins);
    },
    
    // Update an existing bin
    updateBin: function(binId, updatedData) {
        const bins = this.getBins();
        const index = bins.findIndex(bin => bin.id === binId);
        
        if (index !== -1) {
            // Update the bin with new data
            bins[index] = { ...bins[index], ...updatedData };
            return this.saveBins(bins);
        }
        
        return null;
    },
    
    // Delete a bin
    deleteBin: function(binId) {
        const bins = this.getBins();
        const filteredBins = bins.filter(bin => bin.id !== binId);
        
        if (filteredBins.length < bins.length) {
            return this.saveBins(filteredBins);
        }
        
        return bins;
    },
    
    // Get all batches
    getBatches: function() {
        const batches = localStorage.getItem(this.STORAGE_KEYS.BATCHES);
        return batches ? JSON.parse(batches) : [];
    },
    
    // Save all batches
    saveBatches: function(batches) {
        localStorage.setItem(this.STORAGE_KEYS.BATCHES, JSON.stringify(batches));
        // Dispatch event for components to update
        document.dispatchEvent(new CustomEvent('batches-updated', {
            detail: { batches: batches }
        }));
        return batches;
    },
    
    // Get a single batch by ID
    getBatchById: function(batchId) {
        const batches = this.getBatches();
        return batches.find(batch => batch.id === batchId) || null;
    },
    
    // Add a new batch
    addBatch: function(batch) {
        const batches = this.getBatches();
        // Generate ID if not provided
        if (!batch.id) {
            batch.id = 'B' + Math.floor(1000 + Math.random() * 9000);
        }
        // Add timestamp if not provided
        if (!batch.createdAt) {
            batch.createdAt = new Date().toISOString();
        }
        batches.push(batch);
        return this.saveBatches(batches);
    },
    
    // Generate mock bins for testing
    generateMockBins: function() {
        const mockBins = [];
        const types = ['green', 'blue', 'red'];
        const sizes = ['small', 'medium', 'large'];
        const statuses = ['active', 'inactive', 'damaged'];
        
        for (let i = 1; i <= 50; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const size = sizes[Math.floor(Math.random() * sizes.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            
            mockBins.push({
                id: 'BIN-' + (1000 + i),
                type: type,
                size: size,
                status: status,
                qrCode: `/api/placeholder/150/150?text=QR+Code+${i}`,
                location: status === 'active' ? {
                    address: `${Math.floor(Math.random() * 1000) + 100} ${['Main', 'Oak', 'Pine', 'Maple', 'Cedar'][Math.floor(Math.random() * 5)]} ${['Street', 'Avenue', 'Boulevard', 'Road', 'Lane'][Math.floor(Math.random() * 5)]}`,
                    coordinates: {
                        lat: 40.7128 + (Math.random() * 0.05 - 0.025),
                        lng: -74.0060 + (Math.random() * 0.05 - 0.025)
                    }
                } : null,
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
                lastUpdated: new Date(Date.now() - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000).toISOString()
            });
        }
        
        return mockBins;
    },
    
    // Generate mock batches for testing
    generateMockBatches: function() {
        const mockBatches = [];
        const types = ['green', 'blue', 'red'];
        const sizes = ['small', 'medium', 'large'];
        
        for (let i = 1; i <= 10; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const size = sizes[Math.floor(Math.random() * sizes.length)];
            const count = Math.floor(Math.random() * 100) + 50;
            
            let typeText = 'Green - Organic';
            if (type === 'blue') typeText = 'Blue - Recyclable';
            if (type === 'red') typeText = 'Red - Hazardous';
            
            let sizeText = 'Small';
            if (size === 'medium') sizeText = 'Medium';
            if (size === 'large') sizeText = 'Large';
            
            mockBatches.push({
                id: '#B' + Math.floor(1000 + Math.random() * 9000),
                type: type,
                typeText: typeText,
                size: size,
                sizeText: sizeText,
                count: count,
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
                qrCodes: Array(count).fill().map((_, index) => ({
                    id: `QR-${i}-${index + 1}`,
                    url: `/api/placeholder/150/150?text=QR+${i}+${index + 1}`
                }))
            });
        }
        
        return mockBatches;
    },
    
    // ===== USER SETTINGS =====
    
    // Get user settings
    getUserSettings: function() {
        const settings = localStorage.getItem(this.STORAGE_KEYS.USER_SETTINGS);
        return settings ? JSON.parse(settings) : this.getDefaultUserSettings();
    },
    
    // Save user settings
    saveUserSettings: function(settings) {
        localStorage.setItem(this.STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
        // Dispatch event for components to update
        document.dispatchEvent(new CustomEvent('user-settings-updated', {
            detail: { settings: settings }
        }));
        return settings;
    },
    
    // Get default user settings
    getDefaultUserSettings: function() {
        return {
            profile: {
                name: 'Sarah Johnson',
                email: 'sarah.johnson@trashdrop.com',
                phone: '(555) 123-4567',
                address: '123 Admin Street, Suite 456, New York, NY 10001',
                avatar: '/api/placeholder/80/80?text=SJ'
            },
            preferences: {
                darkMode: false,
                language: 'en',
                dateFormat: 'MM/DD/YYYY',
                timeZone: 'America/New_York',
                defaultView: 'dashboard',
                privacySettings: {
                    shareLocationData: true,
                    shareUsageStatistics: true,
                    allowMarketingEmails: false
                }
            },
            notifications: {
                email: true,
                inApp: true,
                push: false,
                sms: false,
                alertTypes: {
                    newReports: true,
                    statusChanges: true,
                    systemUpdates: true,
                    scheduledMaintenance: false
                }
            },
            security: {
                twoFactorEnabled: false,
                lastPasswordChange: new Date().toISOString(),
                sessionTimeout: 30, // minutes
                passwordStrength: 'strong',
                securityQuestions: [
                    {
                        question: 'What was your first pet\'s name?',
                        answerHash: 'hashed_answer_would_go_here'
                    }
                ]
            },
            locations: [
                {
                    id: 'loc-1',
                    name: 'Main Office',
                    address: '789 Business Ave, Suite 500, New York, NY 10001',
                    coordinates: {
                        lat: 40.7128,
                        lng: -74.0060
                    },
                    type: 'work',
                    isDefault: true
                },
                {
                    id: 'loc-2',
                    name: 'Home',
                    address: '456 Residential St, Apt 7B, Brooklyn, NY 11201',
                    coordinates: {
                        lat: 40.6782,
                        lng: -73.9442
                    },
                    type: 'home',
                    isDefault: false
                }
            ]
        };
    },
    // Dashboard metrics data
    getMetricsData: function() {
        return {
            activeRequests: {
                total: 142,
                new: 38,
                enRoute: 57,
                completed: 47,
                issues: 12,
                trend: 5 // percentage change in last 24h
            },
            collectorStatus: {
                active: 24,
                idle: 8,
                offline: 6,
                utilization: 78 // percentage
            },
            responseTime: {
                average: 18.3, // minutes
                trend: -2.1, // percentage change
                target: 20 // target minutes
            },
            completionRate: {
                rate: 94.2, // percentage
                trend: 1.5, // percentage change
                target: 95 // target percentage
            }
        };
    },

    // Recent pickup requests data
    getRecentRequests: function() {
        return [
            {
                id: '3854',
                customer: {
                    name: 'John Smith',
                    avatar: '/api/placeholder/28/28'
                },
                address: '742 Evergreen Terrace',
                collector: {
                    name: 'Miguel R.',
                    avatar: '/api/placeholder/28/28'
                },
                status: 'new',
                created: '10:24 AM',
                eta: '10:45 AM'
            },
            {
                id: '3853',
                customer: {
                    name: 'Emily Johnson',
                    avatar: '/api/placeholder/28/28'
                },
                address: '123 Main Street',
                collector: {
                    name: 'Sarah L.',
                    avatar: '/api/placeholder/28/28'
                },
                status: 'en-route',
                created: '10:15 AM',
                eta: '10:35 AM'
            },
            {
                id: '3852',
                customer: {
                    name: 'Michael Brown',
                    avatar: '/api/placeholder/28/28'
                },
                address: '456 Oak Avenue',
                collector: {
                    name: 'David K.',
                    avatar: '/api/placeholder/28/28'
                },
                status: 'completed',
                created: '09:50 AM',
                eta: '10:20 AM'
            },
            {
                id: '3851',
                customer: {
                    name: 'Jessica Williams',
                    avatar: '/api/placeholder/28/28'
                },
                address: '789 Pine Boulevard',
                collector: {
                    name: 'Alex M.',
                    avatar: '/api/placeholder/28/28'
                },
                status: 'issue',
                created: '09:45 AM',
                eta: 'Delayed'
            }
        ];
    },

    // Priority alerts data
    getPriorityAlerts: function() {
        return [
            {
                type: 'critical',
                icon: 'exclamation-triangle',
                iconClass: 'text-red-500',
                bgClass: 'bg-red-100',
                title: 'Pickup Delay',
                description: 'Request #3851 is 25 minutes overdue',
                time: '5m',
                actions: [
                    { label: 'View Request', class: 'bg-gray-100 text-gray-600' },
                    { label: 'Reassign', class: 'bg-blue-100 text-blue-600' }
                ]
            },
            {
                type: 'warning',
                icon: 'route',
                iconClass: 'text-orange-500',
                bgClass: 'bg-orange-100',
                title: 'Route Deviation',
                description: 'Collector #42 is off expected route',
                time: '18m',
                actions: [
                    { label: 'View Map', class: 'bg-gray-100 text-gray-600' },
                    { label: 'Contact', class: 'bg-blue-100 text-blue-600' }
                ]
            },
            {
                type: 'info',
                icon: 'user-clock',
                iconClass: 'text-purple-500',
                bgClass: 'bg-purple-100',
                title: 'Collector Idle',
                description: 'Collector #18 idle for 15+ minutes',
                time: '22m',
                actions: [
                    { label: 'Check Status', class: 'bg-gray-100 text-gray-600' },
                    { label: 'Contact', class: 'bg-blue-100 text-blue-600' }
                ]
            },
            {
                type: 'feedback',
                icon: 'flag',
                iconClass: 'text-blue-500',
                bgClass: 'bg-blue-100',
                title: 'Customer Feedback',
                description: 'Request #3701 received negative feedback',
                time: '45m',
                actions: [
                    { label: 'View Details', class: 'bg-gray-100 text-gray-600' },
                    { label: 'Respond', class: 'bg-blue-100 text-blue-600' }
                ]
            }
        ];
    },

    // Map data for live request map
    getMapData: function() {
        return {
            center: { lat: 40.7128, lng: -74.0060 }, // New York
            zoom: 12,
            markers: [
                {
                    position: { lat: 40.7282, lng: -73.9942 },
                    type: 'new',
                    requestId: '3854',
                    address: '742 Evergreen Terrace',
                    customer: 'John Smith',
                    created: '10:24 AM'
                },
                {
                    position: { lat: 40.7179, lng: -74.0029 },
                    type: 'en-route',
                    requestId: '3853',
                    address: '123 Main Street',
                    customer: 'Emily Johnson',
                    created: '10:15 AM'
                },
                {
                    position: { lat: 40.7069, lng: -74.0113 },
                    type: 'completed',
                    requestId: '3852',
                    address: '456 Oak Avenue',
                    customer: 'Michael Brown',
                    created: '09:50 AM'
                },
                {
                    position: { lat: 40.7195, lng: -73.9882 },
                    type: 'issue',
                    requestId: '3851',
                    address: '789 Pine Boulevard',
                    customer: 'Jessica Williams',
                    created: '09:45 AM'
                },
                {
                    position: { lat: 40.7308, lng: -73.9973 },
                    type: 'priority',
                    requestId: '3850',
                    address: '321 Maple Drive',
                    customer: 'Robert Taylor',
                    created: '09:30 AM'
                }
            ],
            collectors: [
                {
                    id: '42',
                    name: 'Miguel R.',
                    position: { lat: 40.7250, lng: -73.9950 },
                    status: 'active',
                    speed: 18, // mph
                    heading: 45, // degrees
                    vehicle: 'truck-pickup',
                    assignedRequest: '3854'
                },
                {
                    id: '18',
                    name: 'Sarah L.',
                    position: { lat: 40.7150, lng: -74.0050 },
                    status: 'idle',
                    speed: 0,
                    heading: 0,
                    vehicle: 'truck',
                    assignedRequest: null
                }
            ]
        };
    }
};

// Export for use in other scripts
window.DataService = DataService.init();
