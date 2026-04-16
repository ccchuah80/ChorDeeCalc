
function gameHandler() {
    return {
        settings: {
            players: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
            baseAmount: 2,
            includeBaseInMult: false,
            weight: 1,
            allowRoundUp: true,
            winnerTakeAllOnly: false,
            multFirstThenBal: false,
            x2: 8, x3: 12, x4: 14,
            date: '' 
        },
        rows: [],
        totals: [0, 0, 0, 0],
        showSettings: true,
        sumWarning: false,
        showSummary: false,
        showRules: false,

        init() {
            const saved = localStorage.getItem('algo_v1_enhanced_v2');
            if (saved) {
                const data = JSON.parse(saved);
                this.settings = data.settings;
                this.rows = data.rows;
            } else {
                for (let i = 0; i < 10; i++) this.createRow();
            }
            this.calculateAll();
        },

        createRow() {
            this.rows.push({
                time: '', // Blank initially
                cards: [null, null, null, null],
                results: [0, 0, 0, 0],
                special: [0, 0, 0, 0],
                showSpecial: false,
                isDouble: false
            });
        },

        hasSpecialValues(row) {
            return row.special.some(v => v !== 0 && v !== null && v !== '');
        },

        addRows() {
            for (let i = 0; i < 5; i++) this.createRow();
            this.save();
        },

        deleteRow(index) {
            if (confirm(`Delete round ${index + 1}?`)) {
                this.rows.splice(index, 1);
                this.calculateTotals();
                this.save();
            }
        },

        getMultiplier(cards) {
            if (cards >= this.settings.x4) return 4;
            if (cards >= this.settings.x3) return 3;
            if (cards >= this.settings.x2) return 2;
            return 1;
        },

        calculateRow(index) {
            let row = this.rows[index];                
            let r = [0, 0, 0, 0];
            let c = row.cards.map(v => parseInt(v) || 0);
            let winnerIdx = c.indexOf(0);
            let active = winnerIdx !== -1 && c.some(v => v > 0);

            // TIMESTAMP LOGIC: Only stamp if active and time is currently empty
            if (active && !row.time) {
                const now = new Date();
                row.time = now.getHours().toString().padStart(2, '0') + ':' + 
                           now.getMinutes().toString().padStart(2, '0');
                           
            // NEW: Set the master record date if it hasn't been set yet
    		if (!this.settings.date) {
        		this.settings.date = now.toLocaleDateString('en-GB'); // Formats as DD/MM/YYYY
            	}
            }

            if (active) {
                let winnerGains = 0;
                c.forEach((count, i) => {
                    if (i === winnerIdx) return;
                    let mult = this.getMultiplier(count);
                    let amt = 0;
                    if (!this.settings.includeBaseInMult) {
                        amt = (count * this.settings.weight * mult) + this.settings.baseAmount;
                    } else {
                        amt = ((count * this.settings.weight) + this.settings.baseAmount) * mult;
                    }
                    if (row.isDouble) amt *= 2; 
                    if (this.settings.allowRoundUp) amt = Math.ceil(amt);
                    r[i] -= amt;
                    winnerGains += amt;
                });
                r[winnerIdx] = winnerGains;

                if (!this.settings.winnerTakeAllOnly) {
                    for(let i=0; i<4; i++) {
                        for(let j=i+1; j<4; j++) {
                            if (i === winnerIdx || j === winnerIdx) continue;
                            let sideAmt = 0;
                            if (!this.settings.multFirstThenBal) {
                                sideAmt = Math.abs(c[i] - c[j]) * this.settings.weight * this.getMultiplier(Math.max(c[i], c[j]));
                            } else {
                                sideAmt = Math.abs((c[i] * this.settings.weight * this.getMultiplier(c[i])) - (c[j] * this.settings.weight *  this.getMultiplier(c[j])));
                            }
                            if (this.settings.allowRoundUp) sideAmt = Math.ceil(sideAmt);
                            if (c[i] > c[j]) { r[i] -= sideAmt; r[j] += sideAmt; }
                            else if (c[j] > c[i]) { r[j] -= sideAmt; r[i] += sideAmt; }
                        }
                    }
                }
            }

            row.special.forEach((val, i) => { r[i] += (parseFloat(val) || 0); });
            row.results = r;
            this.calculateTotals();
            this.save();
        },

        calculateTotals() {
            let nt = [0, 0, 0, 0];
            let checkSum = 0;
            this.rows.forEach(row => {
                row.results.forEach((v, i) => { nt[i] += v; checkSum += v; });
            });
            this.totals = nt;
            this.sumWarning = Math.abs(checkSum) > 0.01;
        },

        calculateAll() {
            this.rows.forEach((_, i) => this.calculateRow(i));
        },

        save() {
            localStorage.setItem('algo_v1_enhanced_v2', JSON.stringify({ settings: this.settings, rows: this.rows }));
        },

        resetGame() {
            if (confirm("Reset current scores and players?")) {
                localStorage.removeItem('algo_v1_enhanced_v2');
                location.reload();
            }
        },

        get summaryRanks() {
            const sort = (arr) => [...arr].sort((a,b) => b.val - a.val);
            let amt = this.settings.players.map((n, i) => ({ name: n, val: this.totals[i] }));
            let wins = this.settings.players.map((n, i) => ({
                name: n, val: this.rows.filter(r => r.cards[i] === 0 && r.cards.some(v => v > 0)).length
            }));
            return { amount: sort(amt), wins: sort(wins) };
        },

        exportData() {
            let csv = "Time,Round," + this.settings.players.join(",") + ",Final_" + this.settings.players.join(",Final_") + ",D3Win\n";
            this.rows.forEach((r, i) => {
                csv += `${r.time},${i+1},${r.cards.join(",")},${r.results.join(",")},${r.isDouble ? 'YES' : 'NO'}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AlgoResults_${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
        },

        async captureTable() {
    const container = document.querySelector('.table-container');
    const table = container.querySelector('table');
    const stickyElements = table.querySelectorAll('.sticky');

    // 1. Calculate TRUE dimensions (including hidden scrollable areas)
    const fullWidth = table.scrollWidth; 
    const fullHeight = table.scrollHeight;

    // 2. Store original styles to restore later
    const originalMaxHeight = container.style.maxHeight;
    const originalOverflow = container.style.overflow;
    const originalWidth = container.style.width;

    // 3. Prep: Disable Sticky & Expand Container
    stickyElements.forEach(el => el.style.position = 'static');
    container.style.maxHeight = 'none';
    container.style.overflow = 'visible';
    container.style.width = fullWidth + 'px';

    try {
        const canvas = await html2canvas(container, {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
				allowTaint: true,
            width: fullWidth,
            height: fullHeight,
            windowWidth: fullWidth,
            windowHeight: fullHeight,
            scrollY: -window.scrollY,
            onclone: (clonedDoc) => {
    
                // Ensure the cloned container doesn't squash the table
                const clonedContainer = clonedDoc.querySelector('.table-container');
                clonedContainer.style.width = fullWidth + 'px';
                clonedContainer.style.maxWidth = 'none';

                // Force vertical alignment and input values in the screenshot
                clonedDoc.querySelectorAll('td, th').forEach(cell => {
                    cell.style.verticalAlign = 'middle';
                    cell.style.textAlign = 'center';
                    cell.style.display = 'table-cell';
                });

                clonedDoc.querySelectorAll('input').forEach(input => {
                    input.setAttribute('value', input.value);
                    input.style.textAlign = 'center';
                    input.style.lineHeight = '30px';
                });
            }
        });

        // 4. Formatted Date for Filename (YYYYMMDD_HHMM)
        const now = new Date();
        const dateStr = now.getFullYear() + 
                (now.getMonth() + 1).toString().padStart(2, '0') + 
                now.getDate().toString().padStart(2, '0');
        const timeStr = now.getHours().toString().padStart(2, '0') + 
                now.getMinutes().toString().padStart(2, '0');

        const link = document.createElement('a');
        link.download = `ChorDaiDee_Summary_${dateStr}_${timeStr}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    } catch (error) {
        console.error("Screenshot failed:", error);
        alert("Screenshot failed. Try again or check browser permissions.");
    } finally {
        // 5. Restore everything to original state
        container.style.maxHeight = originalMaxHeight;
        container.style.overflow = originalOverflow;
        container.style.width = originalWidth;
        stickyElements.forEach(el => el.style.position = '');
    }
        }
    }
}
