// alert("js")
const floorDiffInPixel = -160
const doorSpeed = 156.25
const liftSpeed = 12.5;

const Status = {
    moving: "moving",
    idle: "idle",
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

const handleCreateEngineState = (lifts, floors, root) => {
    const floorStatus = new Map();
    const basement = floors < 0? true: false;
    
    for(let i = 0; i < Math.abs(floors); i++){
        floorStatus.set(i, new Map());
    }
    const liftStatus = new Map();

    for(let i = 0; i < lifts; i++){
        liftStatus.set(i, {
            currentFloor: 0, 
            destFloor: undefined, 
            status: Status.idle, 
            currentPos: 0,
            calledFor: "none"
        })
    }

    floorStatus.set(0, new Map(liftStatus));

    const engineState = {
        basement: basement,
        floors: Math.abs(floors),
        lifts: lifts,
        requestQueue: [],
        root: root,
        cleanUp: new Map(),
        liftStatus: liftStatus,
        floorStatus: floorStatus,
    };
    
    return engineState;
}


let engineState;

const handleUpdateLiftStatus = (lift, status) => {
    const prevState= engineState.liftStatus.get(lift);
    engineState.liftStatus.set(lift, {
       ...prevState, ...status
    })
}

const handleDeleteLiftStatus = (floor, lift) => {
    engineState.floorStatus.get(floor).delete(lift);
}

const handleAddLiftStatus = (floor, lift, status) => {
    engineState.floorStatus.get(floor).set(lift, status);
}


const handleChangeDoorPos = (lift, liftDiv, floor, calledFor) => {
    return new Promise((resolve, reject)=>{
        const leftDoor = liftDiv.querySelector(".door-left-part");
        const rightDoor = liftDiv.querySelector(".door-right-part");
        const liftInnerWall = liftDiv.querySelector(".lift-inner-wall");
        const {liftStatus} = engineState;
        
        let id;

        clearInterval(id);
        
        leftDoor.classList.add("door-left-part-open-animation")
        rightDoor.classList.add("door-right-part-open-animation");
        liftInnerWall.classList.add("door-open-animation");

        handleUpdateLiftStatus(lift, {
            status: Status.moving,
            calledFor: calledFor
        })

        id = setTimeout(()=>{

            leftDoor.classList.remove("door-left-part-open-animation");
            rightDoor.classList.remove("door-right-part-open-animation");
            liftInnerWall.classList.remove("door-open-animation");

            leftDoor.classList.add("door-left-part-close-animation");
            rightDoor.classList.add("door-right-part-close-animation");
            liftInnerWall.classList.add("door-close-animation");

            id = setTimeout(()=>{

                leftDoor.classList.remove("door-left-part-close-animation");
                rightDoor.classList.remove("door-right-part-close-animation");
                liftInnerWall.classList.remove("door-close-animation");

                handleUpdateLiftStatus(lift, {
                    status: Status.idle,
                    destFloor: undefined,
                })

                handleAddLiftStatus(floor, lift, liftStatus.get(lift));
                resolve(`Lift ${lift} doors are closed and lift is idle now.`);
                return;
            }, 2500)

        }, 2500)

        engineState.cleanUp.set(id, {lift:lift});
    })
}

const handleChangeLiftPos = (info, lift, floor, calledFor, liftDiv) => {
    return new Promise((resolve, reject)=>{
        const {liftStatus} = engineState;   
        const {initialLiftPos, finalLiftPos, direction} = info;

        let id;
        let initialPos = initialLiftPos;
        let finalPos = finalLiftPos;

        clearInterval(id);

        handleDeleteLiftStatus(liftStatus.get(lift).currentFloor, lift);
        handleAddLiftStatus(floor, lift, {...liftStatus.get(lift),status:Status.moving, calledFor:calledFor});

        id = setInterval(()=>{
            if(Math.abs(initialPos - finalPos) > Math.abs(initialLiftPos - finalLiftPos)){
                reject(`Alert! Lift ${lift} is not working.`);
                return;
            }
            
            if (initialPos === finalPos) {
                clearInterval(id);
                engineState.cleanUp.delete(id);
                handleUpdateLiftStatus(lift, {
                    currentPos: finalPos,
                    currentFloor: floor,
                })
                resolve(`Lift ${lift} reached at ${floor} floor`);
                return;
            }else {
                
                initialPos = direction === Direction.up? initialPos - 1: initialPos + 1;  
                
                liftDiv.style.top = initialPos + "px";

                handleUpdateLiftStatus(lift, {
                    status: Status.moving,
                    currentPos: initialPos,
                    destFloor: floor,
                    calledFor: calledFor
                })
            }
        }, liftSpeed);

        engineState.cleanUp.set(id, {lift:lift});
    })
}

const handleGetLiftInfo = (lift, floor) => {

    let direction = Direction.none;
    const {liftStatus,  basement} = engineState;

    if(liftStatus.get(lift).currentFloor < floor) {
        direction = basement ? Direction.down: Direction.up;
    }else if(liftStatus.get(lift).currentFloor > floor){
        direction = basement ? Direction.up : Direction.down;
    }

    const initialLiftPos = liftStatus.get(lift).currentPos;
    let finalLiftPos = floorDiffInPixel*floor;
    
    if(basement){
        finalLiftPos = Math.abs(finalLiftPos)
    }

    return {
        initialLiftPos,
        finalLiftPos,
        direction
    }
}


const handleGetNearestLift = (floor, calledFor) => {
    let lift = -1;
    let minimumDistance = Infinity;

    const floorPos = Math.abs(floor*floorDiffInPixel);
    const {floorStatus, liftStatus} = engineState;

    const liftAtCurrentFloorInfo = floorStatus.get(floor).entries().find(([_, status], _idx)=> status.calledFor === calledFor)
    
    if(liftAtCurrentFloorInfo){
        // console.log("lift from floor map", liftAtCurrentFloorInfo[0]);
        return liftAtCurrentFloorInfo[0];
    }

    liftStatus.forEach((ls, idx)=>{
        
        const currentPos = Math.abs(ls.currentPos);
        const diff = Math.abs(floorPos - currentPos);

        if(ls.status === Status.idle && diff !== 0
        && diff < minimumDistance){
            minimumDistance = diff;
            lift = idx;
        }
    })

    // console.log("lift from idle lift not at current floor loop ",lift)

    liftStatus.forEach((ls, idx)=>{
        const currentPos = Math.abs(ls.currentPos);
        const diff = Math.abs(floorPos - currentPos);
        
        if(diff == 0 && (calledFor === ls.calledFor ||  ls.calledFor === Direction.none)
             && diff < minimumDistance){
            minimumDistance = diff;
            lift = idx;
        }
    })

    // console.log("lift from idle lift or moving lift at current floor loop ",lift)

    liftStatus.forEach((ls, idx)=>{
        
        const currentPos = Math.abs(ls.currentPos);
        const diff = Math.abs(floorPos - currentPos);

        if(ls.status === Status.moving && diff !== 0
             && ls.calledFor === calledFor && ls.destFloor === floor
             && diff < minimumDistance){
            minimumDistance = diff;
            lift = idx;
        }
    })
    // console.log("lift from moving lift not at current floor loop ",lift)
    return lift;
}


const handleMoveLift = () => {
    return new Promise(async(resolve, reject)=>{
        const {requestQueue, liftStatus} = engineState;
        
        const floorInfo = requestQueue.shift();
       
        if(!floorInfo){
            return;
        }

        const {floor, calledFor} = floorInfo;

        let lift = handleGetNearestLift(floor, calledFor);

        if(lift === -1){
            setTimeout(()=>{
                requestQueue.push({floor: floor, calledFor: calledFor});
            }, 500)
            resolve(`Failed to process request for floor ${floor} at the moment`);
            return;
        }

        const info = handleGetLiftInfo(lift, floor);
        
        const liftDiv = document.getElementById(`lift-${lift}-setup`);

        const currentLiftInfo = liftStatus.get(lift);

        const currentFloor = currentLiftInfo.currentFloor;
        const status = currentLiftInfo.status;

        if(status === Status.idle && currentFloor === floor){
            await handleChangeDoorPos(lift, liftDiv, floor, calledFor);
            resolve(`Processed request for floor ${floor}, called for ${calledFor} by lift ${lift}`);
            return;
        }

        if(status === Status.idle && currentFloor !== floor){
            await handleChangeLiftPos(info, lift, floor, calledFor, liftDiv);
            await handleChangeDoorPos(lift, liftDiv, floor, calledFor);
            resolve(`Processed request for floor ${floor}, called for ${calledFor} by lift ${lift}`);
            return;
        }
    });
}

const handleFloorRequest = async (e)=> {
    const floor = Number(e.target.getAttribute("floor"));
    const calledFor = e.target.getAttribute("btn");
    const {requestQueue} = engineState;

    requestQueue.push({floor: floor, calledFor: calledFor});

    try{
        while(requestQueue.length > 0){
            const response = await handleMoveLift();
            console.log(response);

        }
    }catch(error){
        console.log(error);
    }

}

const handleCreateEngine = () => {
    const engine = document.createElement("div");
    engine.classList.add("engine");

    const {lifts, basement, floors, root} = engineState;

    if (basement === false) {
        engine.classList.add("reverse")
    } else {
        engine.classList.add("normal")
    }

    const liftSetup = document.createElement("div");
    liftSetup.classList.add("lifts");

    Array(lifts).fill().forEach((_, idx)=>{

        const nthLiftSetup = document.createElement("div");
        nthLiftSetup.classList.add("nth-lift-setup");

        const liftInnerWall = document.createElement("div");
        liftInnerWall.classList.add("lift-inner-wall");
        
        const doorLeftPart = document.createElement("div");
        doorLeftPart.classList.add("door-left-part");
        
        const doorRightPart = document.createElement("div");
        doorRightPart.classList.add("door-right-part");
        
        const liftBoundary = document.createElement("div");
        liftBoundary.classList.add("lift-boundary");
        
        liftBoundary.append(liftInnerWall, doorLeftPart, doorRightPart);

        nthLiftSetup.setAttribute("id",`lift-${idx}-setup`);
        nthLiftSetup.append(liftBoundary)
        liftSetup.append(nthLiftSetup);
    })

    const floorSetup = document.createElement("div");
    floorSetup.classList.add("floors");
   

    Array(floors).fill().forEach((_, idx)=>{

        const floorMarkInnerDiv = document.createElement("div");
        floorMarkInnerDiv.innerHTML = `FLR ${idx === 0 ? "G": idx}`
        
        const floorMark = document.createElement("div");
        floorMark.classList.add("floor-mark");
        
        floorMark.append(floorMarkInnerDiv);
        
        const nthFloorButton = document.createElement("div");
        nthFloorButton.classList.add("nth-floor-btn");
        
        let floorButton = document.createElement("button");
        floorButton.classList.add("floor-btn");
        floorButton.classList.add("up-btn");
        floorButton.setAttribute("btn", "up");
        floorButton.setAttribute("floor", idx)
        floorButton.classList.add((basement === false && idx === floors - 1) || (basement === true && idx === 0) ? 'hide' : 'unhide');
        floorButton.innerHTML = "Up";
        nthFloorButton.append(floorButton);
        
        floorButton = document.createElement("button");
        floorButton.classList.add("floor-btn");
        floorButton.classList.add("down-btn");
        floorButton.setAttribute("btn", "down");
        floorButton.setAttribute("floor", idx)
        floorButton.classList.add((basement === false && idx === 0) || (basement === true && idx === floors - 1) ? 'hide' : 'unhide');
        floorButton.innerHTML = "Down";
        nthFloorButton.append(floorButton);
        
        const nthFloorButtonSetup = document.createElement("div");
        nthFloorButtonSetup.classList.add("nth-floor-btn-setup");
        
        nthFloorButtonSetup.append(floorMark);
        nthFloorButtonSetup.append(nthFloorButton);
        
        const nthFloorSetup = document.createElement("div");
        nthFloorSetup.classList.add("nth-floor-setup");
        nthFloorSetup.setAttribute("id", `floor-${idx}-setup`);
        
        nthFloorSetup.append(nthFloorButtonSetup)

        if(idx === 0){
            nthFloorSetup.append(liftSetup);
        }
        
        floorSetup.append(nthFloorSetup);
    })

    engine.append(floorSetup);
    root.append(engine)

    const floorBtns = document.querySelectorAll(".floor-btn")
    floorBtns.forEach((floorBtn, _) => {
        floorBtn.addEventListener("click", handleFloorRequest)
    })
}

const Form = `
<form id="form">
    <div class="form-item">
        <!-- <label for="floor">Floors</label> -->
        <input type="tel" id="floor" name="floor" placeholder="Floors"/>
    </div>
    <div class="form-item">
        <!-- <label for="lift">Lifts</label> -->
        <input type="tel" id="lift" name="lift" placeholder="Lifts"/>
    </div>
    <button class="submit-btn" type="submit">Start</button>
</form>
`

const root = document.getElementById("root");
root.innerHTML = Form;

const floorInput = document.getElementById("floor");
const liftInput = document.getElementById("lift");

const form = document.getElementById("form")
form.addEventListener("submit", onSubmit);

floorInput.addEventListener("keyup", validateInput);
liftInput.addEventListener("keyup", validateInput);

function validateInput(e){
    let value = e.target.value;
    const engine = document.querySelector(".engine");

    if(value.length === 0) {
        if(engine){
            engine.remove()
        }
        return;
    };


    if(value === " "){
        alert("Must be a number");
        e.target.value = ""
        if(engine){
            engine.remove()
        }
        return;
    }

    if(value[0] === "-"){
        value = Number(value.split("-")[1])
    }else if(value[0] === "+"){
        value = Number(value.split("+")[1])
    }else{
        value = Number(value)
    }
    
    if(Number.isNaN(value)){
        alert("Must be a number");
        e.target.value = ""
        if(engine){
            engine.remove()
        }
        return;
    }
}

function onSubmit(e){
    e.preventDefault();

    const formData = new FormData(form);
    const lifts = Number(formData.get("lift"));
    const floors = Number(formData.get("floor"))

    if(Number.isNaN(floors) || Number.isNaN(lifts)){
        alert("Must be a number");
        return;
    }else if(lifts < 0){
        alert("Lifts must be positive number");
        return;
    }else if(floors == 0){
        alert("Floors must be a non zero value");
        return;
    }

    if(engineState){
        console.log("cleaning animation..........")
        
        engineState.cleanUp.keys().forEach((id, _)=>{
            clearInterval(id);
            clearTimeout(id);
            
        })
        
        engineState.requestQueue = []
        engineState.cleanUp.clear();
    }

    engineState = handleCreateEngineState(Math.ceil(lifts), Math.ceil(floors), root);
    
    const engine = document.querySelector(".engine");
    
    if(engine){
        engine.remove()
    }

    handleCreateEngine()
}