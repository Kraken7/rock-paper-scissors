import { ethers } from "hardhat";
import { RockPaperScissors, RockPaperScissors__factory } from "../typechain-types";

async function main() {
    const RockPaperScissors: RockPaperScissors__factory = await ethers.getContractFactory("RockPaperScissors");
    const rockPaperScissors: RockPaperScissors = await RockPaperScissors.deploy();
    await rockPaperScissors.deployed();

    console.log(rockPaperScissors.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
