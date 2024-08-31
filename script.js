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
    const engineState = {
        basement: floors < 0? true:false,
        floors: Math.abs(floors) + 1,
        lifts: lifts,
        liftStatus: Array(lifts).fill().map((_, _i)=>{
            return {
                currentFloor: 0, 
                destFloor: undefined, 
                status: Status.idle, 
                currentPos: 0,
                direction: Direction.none,
                calledFor: Direction.none
            }
        }),

        requestQueue: [],
        root: root,
        cleanUp: new Map(),
    };
    
    return engineState;
}


let engineState;

const handleUpdateLiftStatus = (lift, status) => {
    engineState.liftStatus[lift] = {
        ...engineState.liftStatus[lift], ...status
    }
}

const handleChangeDoorPos = (lift, liftDiv, calledFor) => {
    return new Promise((resolve, reject)=>{
        const leftDoor = liftDiv.querySelector(".door-left-part");
        const rightDoor = liftDiv.querySelector(".door-right-part");
        const liftInnerWall = liftDiv.querySelector(".lift-inner-wall");
        
        let id;

        clearInterval(id);

        handleUpdateLiftStatus(lift, {
            status: Status.moving,
            calledFor: calledFor,
        })
        
        leftDoor.classList.add("door-left-part-open-animation")
        rightDoor.classList.add("door-right-part-open-animation");
        liftInnerWall.classList.add("door-open-animation");

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
                    calledFor: Direction.none
                })
                resolve(`Lift ${lift} doors are closed and lift is idle now.`);
                return;
            }, 2500)

        }, 2500)

        engineState.cleanUp.set(id, {lift:lift});
    })
}

const handleChangeLiftPos = (info, lift, floor, calledFor, liftDiv) => {
    return new Promise((resolve, reject)=>{

        const {initialLiftPos, finalLiftPos, direction} = info;

        let id;
        let initialPos = initialLiftPos;
        let finalPos = finalLiftPos;

        clearInterval(id);

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
                    direction: Direction.none,
                    destFloor: undefined,
                })
                resolve(`Lift ${lift} reached at ${floor} floor`);
                return;
            }else {
                
                initialPos = direction === Direction.up? initialPos - 1: initialPos + 1;  
                
                liftDiv.style.top = initialPos + "px";

                handleUpdateLiftStatus(lift, {
                    status: Status.moving,
                    direction: direction,
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
    const {liftStatus, basement} = engineState;
        
    if(liftStatus[lift].currentFloor < floor) {
        direction = basement ? Direction.down: Direction.up;
    }else if(liftStatus[lift].currentFloor > floor){
        direction = basement ? Direction.up : Direction.down;
    }

    const initialLiftPos = liftStatus[lift].currentPos;
    let finalLiftPos = floorDiffInPixel*floor;
    
    if(basement){
        finalLiftPos = Math.abs(finalLiftPos)
    }

    return {
        initialLiftPos,
        finalLiftPos,
        direction,
    }
}

const handleGetNearestLift = (floor, calledFor) => {
    let lift = -1;
    let minimumDistance = Infinity;

    const floorPos = Math.abs(floor*floorDiffInPixel);
    const {liftStatus, basement} = engineState;



    if(calledFor === Direction.up){
    
        liftStatus.forEach((ls, idx)=>{
            const currentPos = Math.abs(ls.currentPos);
            const diff = Math.abs(floorPos - currentPos);

            if(ls.calledFor === calledFor && 
                (!basement?(currentPos < floorPos && ls.destFloor >= floor):(currentPos>floorPos))
                && diff < minimumDistance
            ){
                minimumDistance = diff;
                lift = idx;
            }

        })        
    }else if(calledFor === Direction.down){

        liftStatus.forEach((ls, idx)=>{
            const currentPos = Math.abs(ls.currentPos);
            const diff = Math.abs(floorPos - currentPos);

            if(ls.calledFor === calledFor &&
                (basement?(currentPos < floorPos && ls.destFloor >= floor):(ls.destFloor === floor && currentPos < floorPos) || (currentPos > floorPos))
                && diff < minimumDistance
            ){
                minimumDistance = diff;
                lift = idx;
            }

        })
    }

    // console.log(lift);

    liftStatus.forEach((ls, idx)=>{
        const currentPos = Math.abs(ls.currentPos);
        const diff = Math.abs(floorPos - currentPos);
        
        if(diff === 0 && ls.status === Status.moving && ls.calledFor === calledFor
             && diff < minimumDistance){
            minimumDistance = diff;
            lift = idx;
        }
    })

    // console.log("lift from moving lift at current floor called for loop ",lift)

    liftStatus.forEach((ls, idx)=>{
        
        const currentPos = Math.abs(ls.currentPos);
        const diff = Math.abs(floorPos - currentPos);

        if(ls.status === Status.idle && ls.currentFloor !== floor
        && diff < minimumDistance){
            minimumDistance = diff;
            lift = idx;
        }
    })
    // console.log("lift from idle lift not at current floor loop ",lift)

    liftStatus.forEach((ls, idx)=>{
        const currentPos = Math.abs(ls.currentPos);
        const diff = Math.abs(floorPos - currentPos);
        
        if(ls.currentFloor === floor && ls.status === Status.idle
             && diff < minimumDistance){
            minimumDistance = diff;
            lift = idx;
        }
    })
    // console.log("lift from idle lift at current floor loop ",lift)


    liftStatus.forEach((ls, idx)=>{
        
        const currentPos = Math.abs(ls.currentPos);
        const diff = Math.abs(floorPos - currentPos);

        if(ls.status === Status.moving && ls.currentFloor !== floor && ls.destFloor === floor && ls.calledFor === calledFor
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
        const {requestQueue, liftStatus, cleanUp } = engineState;
        
        const floorInfo = requestQueue.shift();
       
        if(!floorInfo){
            return;
        }

        const {floor, calledFor} = floorInfo;
        // console.log("Floor ", floor, "called for ", calledFor);

        let lift = handleGetNearestLift(floor, calledFor);

        // console.log("lift", lift)

        if(lift === -1){
            setTimeout(()=>{
                requestQueue.push({floor: floor, calledFor: calledFor});
            }, 1000)
            resolve(`Failed to process request for floor ${floor} at the moment`);
            return;
        }

        const info = handleGetLiftInfo(lift, floor);
        
        const liftDiv = document.getElementById(`lift-${lift}-setup`);

        const currentLiftInfo = liftStatus[lift];

        let destFloor = currentLiftInfo.destFloor;
        const currentFloor = currentLiftInfo.currentFloor;
        const status = currentLiftInfo.status;
        const liftCalledFor = currentLiftInfo.calledFor;
        const currentPos = Math.abs(currentLiftInfo.currentPos);
        const floorPos = Math.abs((destFloor?destFloor:0)*floorDiffInPixel);
        const newfloorPos = Math.abs(floor*floorDiffInPixel);

        // console.log("Status ", status, "lift called for ", liftCalledFor, "Current pos ", currentPos);
        // console.log("dest floor pos ", floorPos, "new floor pos ", newfloorPos);
        // console.log("dest floor ", destFloor, "current flr ", currentFloor);
        
        if(currentFloor === floor && status === Status.moving) {
            resolve(`Processed request for floor ${floor}, called for ${calledFor} by lift ${lift}`);
            return; 
        };

        if(status === Status.idle && currentFloor === floor){
            await handleChangeDoorPos(lift, liftDiv, calledFor);
            resolve(`Processed request for floor ${floor}, called for ${calledFor} by lift ${lift}`);
            return;
        }

        if(status === Status.idle && currentFloor !== floor){
            await handleChangeLiftPos(info, lift, floor, calledFor, liftDiv);
            await handleChangeDoorPos(lift, liftDiv, calledFor);
            resolve(`Processed request for floor ${floor}, called for ${calledFor} by lift ${lift}`);
            return;
        }

        if(currentPos <= newfloorPos){
            if(floor > destFloor){
                // timen taken to reach the old dest floor + door movement
                const diff = Math.abs(floorPos - currentPos);
                let time = (diff / Math.abs(floorDiffInPixel))*2000;

                if(status !== Status.moving && status !== Status.idle){
                    time += 700;
                }

                setTimeout(()=>{
                    console.log(`Lift request for floor ${floor}, called for ${calledFor} is in queue`);
                    requestQueue.push({floor: floor, calledFor:calledFor});
                }, time)
                return;
            }else if(floor < destFloor){

                cleanUp.forEach((v, id)=>{
                    if (v.lift === lift){
                        clearTimeout(id);
                        cleanUp.delete(id);
                    }
                })

                // timen taken to reach the new dest floor + door movement
                const diff = Math.abs(newfloorPos - currentPos);
                let time = (diff / Math.abs(floorDiffInPixel))*2000;
               
             
                if(status !== Status.moving && status !== Status.idle){
                    time += 700;
                }


                console.log(`Lift will stop at the floor ${floor}`) 
                setTimeout(()=>{
                    console.log(`Lift request for floor ${destFloor}, called for ${liftCalledFor} is in queue`);
                    requestQueue.push({floor: destFloor, calledFor: liftCalledFor})
                }, time)

                await handleChangeLiftPos(info, lift, floor, calledFor, liftDiv);
                await handleChangeDoorPos(lift, liftDiv, calledFor);
                resolve(`Processed request for floor ${floor}, called for ${calledFor} by lift ${lift}`);
                return;

            }
        
        }else {
               
                if(floor < destFloor){
                    const diff = Math.abs(floorPos - currentPos);
                    let time = (diff / Math.abs(floorDiffInPixel))*2000;

                    if(status !== Status.moving && status !== Status.idle){
                        time += 700;
                    }

                    setTimeout(()=>{
                        console.log(`Lift request for floor ${floor}, called for ${calledFor} is in queue`);
                        requestQueue.push({floor: floor, calledFor:calledFor});
                    }, time)
                    return;

                }else if(floor > destFloor){
                    cleanUp.forEach((v, id)=>{
                        if (v.lift === lift){
                            clearTimeout(id);
                            cleanUp.delete(id);
                        }
                    })
    
                    console.log(`Lift will stop at the floor ${floor}`)

                    // timen taken to reach the new dest floor + door movement
                    const diff = Math.abs(newfloorPos - currentPos);
                    let time = (diff / Math.abs(floorDiffInPixel))*2000;

                    
                    if(status !== Status.moving && status !== Status.idle){
                        time += 700;
                    }

                    setTimeout(()=>{
                            console.log(`Lift request for floor ${destFloor}, called for ${liftCalledFor} is in queue`);
                            requestQueue.push({floor: destFloor, calledFor: liftCalledFor})
                    }, time)

                    await handleChangeLiftPos(info, lift, floor, calledFor, liftDiv);
                    await handleChangeDoorPos(lift, liftDiv, calledFor);
                    resolve(`Processed request for floor ${floor}, called for ${calledFor} by lift ${lift}`);
                    return;
                }        
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

    if(value.length === 0) return;

    if(value === " "){
        alert("Must be a number");
        e.target.value = ""
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
    
    const lastChild = root.lastChild;
    
    if(lastChild){
        root.lastChild.remove()
    }

    handleCreateEngine()
}