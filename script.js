// alert("js")

const Status = {
    moving: "moving",
    idle: "idle",
    closed: "closed",
    opened: "opened",
    reached: "reached"
}

const Action = {
    close: "closing",
    open: "opening"
}

const Direction = {
    up : "up",
    down: "down"
}

class DataStore {
    constructor(lifts, floors, root){
        this.basement = floors < 0? true: false
        this.floors = Math.abs(floors - 0) + 1;
        this.lifts = lifts;
        this.floorDiffInPixel = -160;
        this.doorSpeed = 156.25; //ms
        this.liftSpeed = 12.5; //ms
        this.finalDoorPos = 8
        this.initialDoorPos = 24
        this.liftQueue = Array(this.lifts).fill().map((_, idx)=>idx)
        this.liftStatus = Array(this.lifts).fill().map((_, idx)=>{
            return {"floor": 0,"status": Status.idle, "currentPos": 0}
        })
        this.requestQueue = []
        this.root = root
    }
}

class LiftSimulationEngine {

    constructor(dataStore){
        this.dataStore = dataStore;
    }
    setup(){
        const {floors, basement, lifts} = this.dataStore;
        const floorSetup = document.createElement("div")

        if(basement === false){
            floorSetup.classList.add("reverse-floor-setup");
        }else{
            floorSetup.classList.add("normal-floor-setup");
        }

        const liftSetup = `<div class="lifts">
        ${
            Array(lifts).fill().map((_, idx)=>{
                return `<div class="nth-lift-setup" id="lift-${idx}-setup">
                    <div class="lift-boundary">
                        <div class="door-left-part"></div>
                        <div class="door-right-part"></div>
                    </div>
                </div>`
            }).join("")
        }
        </div>`

        floorSetup.innerHTML = Array(floors).fill().map((_, idx)=>{
            return `<div class="nth-floor-setup" id="floor-${idx}-setup">
                <div class="nth-floor-btn-setup">
                    <div class="floor-mark">
                        <div>FLR ${idx == 0?"G":idx}</div>
                    </div>
                    <div class="nth-floor-btn">
                        <button class="floor-btn up-btn ${(basement === false && idx===floors-1) || (basement === true && idx === 0)?'hide':''}" key=${idx} id="up-${idx}-btn">Up</button>
                        <button class="floor-btn down-btn ${(basement === false && idx===0) || (basement === true && idx === floors-1 )? 'hide':''}" key=${idx} id="down-${idx}-btn">Down</button>
                    </div>
                </div>
                ${idx === 0 ? liftSetup: ""}
            </div>`
        }).join("");

        this.dataStore.root.append(floorSetup)

        const floorBtns = document.querySelectorAll(".floor-btn");

        floorBtns.forEach((floorBtn, _)=>{
            floorBtn.addEventListener("click", this.moveLift);
        })
    }

    nextMovingLiftConfig(currentFloor){

        const lift = this.dataStore.liftQueue.shift();
        
        if(lift === undefined){
            return;
        }

        let direction = 0;
        
        if(this.dataStore.liftStatus[lift].floor < currentFloor) {
            if(this.dataStore.basement === true) direction = Direction.down
            else direction = Direction.up;
        }else{
            if(this.dataStore.basement === true) direction = Direction.up
            else direction = Direction.down;
        }
        
        const floorDiff = this.dataStore.floorDiffInPixel;
        const initialLiftPos = this.dataStore.liftStatus[lift].currentPos;
        const dist = Math.abs(this.dataStore.liftStatus[lift].floor - currentFloor);
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
            lift
        }
    }
    
    move(){
        return new Promise(async (resolve, reject)=>{
            const currentFloor = this.dataStore.requestQueue.shift();
        
            if(currentFloor === undefined){
                reject("No request left to perform");
                return;
            }
    
            const config = this.nextMovingLiftConfig(currentFloor);
            
            if(config === undefined){
                this.dataStore.requestQueue.push(currentFloor);
                reject(`Failed to process request for ${currentFloor} floor`);
                return;
            }
                        
            const {direction, finalLiftPos, initialLiftPos, lift} = config
    
            await this.changeDoorPos(this.dataStore.initialDoorPos, this.dataStore.finalDoorPos, Action.open, lift)
            await this.changeDoorPos(this.dataStore.finalDoorPos, this.dataStore.initialDoorPos, Action.close, lift)
            await this.changeLiftPos(initialLiftPos, finalLiftPos, lift, direction, currentFloor);
            await this.changeDoorPos(this.dataStore.initialDoorPos, this.dataStore.finalDoorPos, Action.open, lift)
            
            let doorClosed = await this.changeDoorPos(this.dataStore.finalDoorPos, this.dataStore.initialDoorPos, Action.close, lift)
            if(doorClosed){
                this.updateLiftStatus(lift, {
                    status: "idle",
                })
                this.dataStore.liftQueue.push(lift);
            }
    
            resolve(`Processed request for floor ${currentFloor}, lift used ${lift+1}, now at ${this.dataStore.liftStatus[lift].floor}`);
        })
    }

    moveLift = async (e) => {
        const currentFloor = Number(e.target.getAttribute("key"));
        this.dataStore.requestQueue.push(currentFloor);

        try{
            while(this.dataStore.requestQueue.length > 0){
                const response = await this.move()
                console.log(response);
                if(this.dataStore.requestQueue.length === 1){
                    const response = await this.move()
                    console.log(response);
                    break;
                }
            }
        }catch(err){
            console.log(err);
        }
    }

    updateLiftStatus(lift, status){
        this.dataStore.liftStatus[lift] = {...this.dataStore.liftStatus[lift], ...status}
    }

    changeDoorPos(initialPos, finalPos, action, lift){
        return new Promise((resolve, reject)=>{
            const liftDiv = document.getElementById(`lift-${lift}-setup`);

            const leftDoor = liftDiv.querySelector('.door-left-part');
            const rightDoor = liftDiv.querySelector('.door-right-part');

            let id = null;
            clearInterval(id);
            
            id = setInterval(()=>{
                if(initialPos === finalPos){
                    clearInterval(id);
                    if(Action.close === action) {
                        this.updateLiftStatus(lift, {
                            status: Status.closed
                        })
                    }
                    else {
                        this.updateLiftStatus({
                            status: Status.opened
                        })
                    };
                    resolve(true);
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
            }, this.dataStore.doorSpeed);
        })
    }
    
    changeLiftPos(initialLiftPos, finalLiftPos, lift, direction, currentFloor){
        return new Promise((resolve, reject)=>{
            const liftDiv = document.getElementById(`lift-${lift}-setup`);
            
            let id = null;
            clearInterval(id);
            
            id = setInterval(()=>{
                if (initialLiftPos === finalLiftPos) {
                    clearInterval(id);
                    this.updateLiftStatus(lift, {
                        currentPos: finalLiftPos,
                        floor: currentFloor,
                        status: Status.reached
                    })
                    resolve(`lift ${lift} reached`)
                } else {
                    
                    initialLiftPos = direction === Direction.up? initialLiftPos - 1: initialLiftPos + 1;  
                    
                    liftDiv.style.top = initialLiftPos + "px";

                    this.updateLiftStatus(lift, {
                        status: Status.moving,
                        direction: direction,
                        currentPos: initialLiftPos
                    })
                }
            }, this.dataStore.liftSpeed)
        })
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

    const dataStore = new DataStore(lifts, floors, root);
    const engine = new LiftSimulationEngine(dataStore)

    const lastChild = root.lastChild;
    if(lastChild){
        root.lastChild.remove()
    }

    engine.setup();
}


