// alert("js")

const Status = {
    moving: "moving",
    idle: "idle",
    opened: "opened",
    reached: "reached"
}

const Action = {
    close: "closing",
    open: "opening"
}

const Direction = {
    up : "up",
    down: "down",
    none: "none",
}
class LiftSimulationEngine {

    constructor(lifts, floors, root) {
        this.basement =  floors < 0 ? true: false,
        this.floors = Math.abs(floors) + 1,
        this.lifts = lifts,
        this.floorDiffInPixel = -160,
        this.doorSpeed = 156.25,
        this.liftSpeed = 12.5,
        this.finalDoorPos = 8,
        this.initialDoorPos = 24,
        this.liftStatus = Array(lifts).fill().map((_, idx)=>{
            return {
                currentFloor: 0, destFloor: undefined, status: Status.idle, currentPos: 0
            }
        }),
        this.requestQueue = [],
        this.root = root,
        this.cleanUp = []
    }

    start() {
        const setup = document.createElement("div")

        if (this.basement === false) {
            setup.classList.add("reverse")
        } else {
            setup.classList.add("normal")
        }

        const liftSetup = `<div class="lifts">
            ${Array(this.lifts).fill().map((_, idx) => {
                    return `<div class="nth-lift-setup" id="lift-${idx}-setup">
                        <div class="lift-boundary">
                            <div class="door-left-part"></div>
                            <div class="door-right-part"></div>
                        </div>
                    </div>`
                }).join("")}
            </div>`

        const floorSetup = `<div class="floors">
            ${Array(this.floors).fill().map((_, idx) => {
                return `<div class="nth-floor-setup" id="floor-${idx}-setup">
                    <div class="nth-floor-btn-setup">
                        <div class="floor-mark">
                            <div>FLR ${idx == 0 ? "G" : idx}</div>
                        </div>
                        <div class="nth-floor-btn">
                            <button class="floor-btn up-btn ${(this.basement === false && idx === this.floors - 1) || (this.basement === true && idx === 0) ? 'hide' : ''}" floor=${idx} btn="up">Up</button>
                            <button class="floor-btn down-btn ${(this.basement === false && idx === 0) || (this.basement === true && idx === this.floors - 1) ? 'hide' : ''}" floor=${idx} btn="down">Down</button>
                        </div>
                    </div>
                    ${idx === 0 ? liftSetup : ""}
                </div>`
            }).join("")}
            </div>`

        setup.innerHTML = floorSetup
        this.root.append(setup)

        const floorBtns = document.querySelectorAll(".floor-btn")
        floorBtns.forEach((floorBtn, _) => {
            floorBtn.addEventListener("click", this.processFloorRequest)
        })
    }

    updateLiftStatus(lift, status){
        this.liftStatus[lift] = {...this.liftStatus[lift], ...status}
    }

    changeDoorPos(action, lift){
        return new Promise((resolve, reject)=>{
            const liftDiv = document.getElementById(`lift-${lift}-setup`);

            if(!liftDiv){
                reject(`Lift ${lift} is not found`);
                return;
            }

            const leftDoor = liftDiv.querySelector('.door-left-part');
            const rightDoor = liftDiv.querySelector('.door-right-part');

            if(!leftDoor || !rightDoor){
                reject(`Lift ${lift}'s doors are not found`)
                return;
            }

            const initialDoorPos = Action.open === action ? this.initialDoorPos : this.finalDoorPos;
            const finalDoorPos = Action.open === action ? this.finalDoorPos: this.initialDoorPos;
            
            let initialPos = initialDoorPos;
            let finalPos = finalDoorPos;
            let id = null;

            clearInterval(id);
            
            id = setInterval(()=>{
                
                if (Math.abs(initialPos - finalPos) > Math.abs(initialDoorPos - finalDoorPos)){
                    reject(`Alert! Lift ${lift} doors are not working`)
                    return;
                }

                if(initialPos === finalPos){
                    clearInterval(id);
                    if(Action.close === action) {
                        this.updateLiftStatus(lift, {
                            status: Status.idle,

                        })
                        resolve(`Lift ${lift} doors are closed`);
                    }
                    else {
                        this.updateLiftStatus({
                            status: Status.opened
                        })
                        resolve(`Lift ${lift} doors are opened`);
                    };
                }else{
                    if(action === Action.close) initialPos++;
                    else initialPos--;

                    leftDoor.style.left = initialPos + 'px'
                    rightDoor.style.right = initialPos + 'px'
                    
                    this.updateLiftStatus(lift, {
                        status: action,
                    })
                }
                // to open/close door in 2.5 sec having distance 16px, excute the interval in 2500/16 ms
            }, this.doorSpeed);

            this.cleanUp.push(id);
        })
    }
    
    changeLiftPos(initialLiftPos, finalLiftPos, lift, direction){
        return new Promise((resolve, reject)=>{
            const liftDiv = document.getElementById(`lift-${lift}-setup`);
            
            if(!liftDiv){
                reject(`Lift ${lift} is not found`);
                return;
            }
            
            let intialPos = initialLiftPos;
            let finalPos = finalLiftPos;
            let id = null;
            const destFloor = this.liftStatus[lift].destFloor;

            clearInterval(id);
            
            id = setInterval(()=>{
                if(Math.abs(intialPos - finalPos) > Math.abs(initialLiftPos - finalLiftPos)){
                    reject(`Alert! Lift ${lift} is not working.`);
                    return;
                }

                if (intialPos === finalPos) {
                    clearInterval(id);
                    this.updateLiftStatus(lift, {
                        currentPos: finalPos,
                        currentFloor: destFloor,
                        status: Status.reached,
                        direction: Direction.none,
                        destFloor: undefined,
                    })
                    resolve(`Lift ${lift} reached at ${destFloor} floor`)
                } else {
                    
                    intialPos = direction === Direction.up? intialPos - 1: intialPos + 1;  
                    
                    liftDiv.style.top = intialPos + "px";

                    this.updateLiftStatus(lift, {
                        status: Status.moving,
                        direction: direction,
                        currentPos: intialPos,
                        destFloor: destFloor
                    })
                }
            }, this.liftSpeed);

            this.cleanUp.push(id);
        })
    }

    move() {
        return new Promise(async (resolve, reject) => {
            const destFloor = this.requestQueue.shift()
            
            const lift = this.getNearestLift(destFloor);

            if(lift === -1){
                this.requestQueue.unshift(destFloor);
                reject(`Failed to process request for floor ${destFloor} at the moment.`)
                return;
            }

            const {initialLiftPos, finalLiftPos, direction} = this.getNearestLiftInfo(lift, destFloor);

            if(this.liftStatus[lift].status === Status.idle){
                if(this.liftStatus[lift].currentFloor === destFloor){
                    /**
                     *  Lift is idle and on the dest floor
                     */
                    await this.changeDoorPos(Action.open, lift);
                    await this.changeDoorPos(Action.close, lift);
                    resolve(`Processed request for floor ${destFloor}`);
                }else{
                    /**
                     * Lift is idle and not on the dest floor
                     */
                    this.liftStatus[lift].destFloor = destFloor;

                    await this.changeLiftPos(initialLiftPos, finalLiftPos, lift, direction);
                    await this.changeDoorPos(Action.open, lift);
                    await this.changeDoorPos(Action.close, lift);

                    resolve(`Processed request for floor ${destFloor}`);
                    return;
                }
            }

            if(this.liftStatus[lift].status !== Status.idle){
                if(this.liftStatus[lift].status !== Status.moving){
                    if(this.liftStatus[lift].currentFloor === destFloor){
                        /**
                         * Lift is not idle, not moving and on the dest floor
                         */
                        await this.changeDoorPos(Action.open, lift);
                        await this.changeDoorPos(Action.close, lift);
                        return;
                    }else{
                        /**
                         * Lift is not idle, not moving and not on the dest floor
                         */
                        this.requestQueue.unshift(destFloor);
                        return;
                    }
                }else{
                    if(this.liftStatus[lift].destFloor === destFloor){
                        /**
                         * Lift is not idle and moving towards to dest floor
                         */
                        return;
                    }else{
                        /**
                         * Lift is not idle and not moving towars dest floor
                         */
                        return;
                    }
                }
            }
        })
    }


    getNearestLiftInfo(lift, destFloor){
        
        let direction = "";
        
        if(this.liftStatus[lift].currentFloor < destFloor) {
            if(this.basement === true) direction = Direction.down
            else direction = Direction.up;
        }else{
            if(this.basement === true) direction = Direction.up
            else direction = Direction.down;
        }
        
        const floorDiff = this.floorDiffInPixel;
        const initialLiftPos = this.liftStatus[lift].currentPos;
        const dist = Math.abs(this.liftStatus[lift].currentFloor - destFloor);
        let finalLiftPos = initialLiftPos;
        
        if(direction === Direction.down){
            finalLiftPos += Math.abs(dist*floorDiff)
        }else if(direction === Direction.up){
            finalLiftPos += dist*floorDiff
        }

        return {
            initialLiftPos,
            finalLiftPos,
            direction,
        }
    }

    getNearestLift(destFloor){

        let minimumDistance = this.floors + 1;
        let lift = -1;

        this.liftStatus.forEach((ls, idx)=>{
            if(((ls.status !== Status.moving && ls.currentFloor === destFloor)
                || (ls.status === Status.moving && ls.destFloor === destFloor) 
                || ls.status === Status.idle) && Math.abs(ls.currentFloor - destFloor) < minimumDistance){
                minimumDistance = Math.abs(ls.currentFloor - destFloor);
                lift = idx;
            }
        })

        return lift;
    }

    processFloorRequest = async (e) => {
        const destFloor = Number(e.target.getAttribute("floor"))

        this.requestQueue.push(destFloor)

        try {
            while (this.requestQueue.length > 0) {
                // process every request
                const response = await this.move();
                console.log(response);
            }
        } catch (error) {
            console.log(error)
        }
    }
}


const Form = `
<form id="form">
    <div class="form-item">
        <!-- <label for="floor">Floors</label> -->
        <input type="text" id="floor" name="floor" placeholder="Floors"/>
    </div>
    <div class="form-item">
        <!-- <label for="lift">Lifts</label> -->
        <input type="text" id="lift" name="lift" placeholder="Lifts"/>
    </div>
    <button class="submit-btn" type="submit">Start</button>
</form>
`

const root = document.getElementById("root");
root.innerHTML = Form;

const form = document.getElementById("form")
form.addEventListener("submit", onSubmit);
let engine = null;

function onSubmit(e){
    e.preventDefault();

    const formData = new FormData(form);
    const lifts = Number(formData.get("lift"));
    const floors = Number(formData.get("floor"))

    if(Number.isNaN(floors) || Number.isNaN(lifts)){
        alert("Must be a number");
        return;
    }else if(lifts <= 0){
        alert("Must be greater than 0");
        return;
    }

    if(engine){
        // cleaning previous intervals
        engine.cleanUp.forEach((id, _)=>clearInterval(id));
    }

    engine = new LiftSimulationEngine(Math.ceil(lifts), Math.ceil(floors), root)

    const lastChild = root.lastChild;

    if(lastChild){
        root.lastChild.remove()
    }

    engine.start();
}


