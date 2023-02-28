import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { RockPaperScissors, RockPaperScissors__factory } from "../typechain-types";

describe("RockPaperScissors", function() {
    async function deploy() {
        const [ player1, player2, player3 ] = await ethers.getSigners();
  
        const RockPaperScissors: RockPaperScissors__factory = await ethers.getContractFactory("RockPaperScissors");
        const rockPaperScissors: RockPaperScissors = await RockPaperScissors.deploy();
        await rockPaperScissors.deployed();
  
        return { rockPaperScissors, player1, player2, player3 };
    }

    const getHashGame = (timeblock: number, address: string): string => {
        return ethers.utils.hexZeroPad(ethers.BigNumber.from(timeblock).add(ethers.BigNumber.from(address)).toHexString(), 32);
    }

    const getHashResult = (hashGame: string, result: number, secret: string, address: string): string => {
        return ethers.utils.solidityKeccak256(
            ['bytes32', 'uint8', 'bytes32', 'address'],
            [hashGame, result, ethers.utils.formatBytes32String(secret), address]
        );
    }

    const getHashSecret = (secret: string): string => {
        return ethers.utils.formatBytes32String(secret);
    }

    it("create game", async function() {
        const { rockPaperScissors, player1 } = await loadFixture(deploy);

        const timeblock = Date.now() + 100;
        await time.setNextBlockTimestamp(timeblock);

        const tx = await rockPaperScissors.createGame();
        const hashGame = getHashGame(timeblock, player1.address);
    
        const gameData = await rockPaperScissors.getGame(hashGame);
        expect(gameData.players[0]).to.eq(player1.address);

        await expect(tx)
            .to.emit(rockPaperScissors, 'GameCreated')
            .withArgs(player1.address, hashGame);
      });

      it("commit result", async function() {
        const { rockPaperScissors, player1 } = await loadFixture(deploy);

        const timeblock = Date.now() + 100;
        await time.setNextBlockTimestamp(timeblock);

        await rockPaperScissors.createGame();

        const hashGame = getHashGame(timeblock, player1.address);
        const hashResult = getHashResult(hashGame, 1, 'secret', player1.address);

        const tx = await rockPaperScissors.commitResult(hashResult, hashGame);

        const gameData = await rockPaperScissors.getGame(hashGame);
        expect(gameData.commits[0]).to.true;

        await expect(tx)
            .to.emit(rockPaperScissors, 'Commited')
            .withArgs(player1.address, hashGame);
      });

      it("commit result - result has been saved", async function() {
        const { rockPaperScissors, player1 } = await loadFixture(deploy);

        const timeblock = Date.now() + 100;
        await time.setNextBlockTimestamp(timeblock);

        await rockPaperScissors.createGame();

        const hashGame = getHashGame(timeblock, player1.address);
        const hashResult = getHashResult(hashGame, 1, 'secret', player1.address);

        await rockPaperScissors.commitResult(hashResult, hashGame);
        await expect(
            rockPaperScissors.commitResult(hashResult, hashGame)
        ).to.be.revertedWith('result has been saved');
      });

      it("commit result - game till not has been created", async function() {
        const { rockPaperScissors, player1 } = await loadFixture(deploy);

        const hashGame = getHashGame(Date.now() + 100, player1.address);
        const hashResult = getHashResult(hashGame, 1, 'secret', player1.address);

        await expect(
            rockPaperScissors.commitResult(hashResult, hashGame)
        ).to.be.revertedWith('game till not has been created');
      });

      it("commit result - game already has players", async function() {
        const { rockPaperScissors, player1, player2, player3 } = await loadFixture(deploy);

        const timeblock = Date.now() + 100;
        await time.setNextBlockTimestamp(timeblock);

        await rockPaperScissors.createGame();

        const hashGame = getHashGame(timeblock, player1.address);
        const hashResult1 = getHashResult(hashGame, 1, 'secret1', player1.address);
        const hashResult2 = getHashResult(hashGame, 2, 'secret2', player2.address);
        const hashResult3 = getHashResult(hashGame, 3, 'secret3', player3.address);

        await rockPaperScissors.commitResult(hashResult1, hashGame);
        await rockPaperScissors.connect(player2).commitResult(hashResult2, hashGame);
        await expect(
            rockPaperScissors.connect(player3).commitResult(hashResult3, hashGame)
        ).to.be.revertedWith('game already has players');
      });

      it("reveral result and winner", async function() {
        const { rockPaperScissors, player1, player2 } = await loadFixture(deploy);

        const timeblock = Date.now() + 100;
        await time.setNextBlockTimestamp(timeblock);

        await rockPaperScissors.createGame();

        const hashGame = getHashGame(timeblock, player1.address);
        const hashResult1 = getHashResult(hashGame, 1, 'secret1', player1.address);
        const hashResult2 = getHashResult(hashGame, 2, 'secret2', player2.address);

        await rockPaperScissors.commitResult(hashResult1, hashGame);

        await expect(
            rockPaperScissors.revealResult(1, getHashSecret('secret1'), hashGame)
        ).to.be.revertedWith('waiting commits from players')

        await rockPaperScissors.connect(player2).commitResult(hashResult2, hashGame);

        await expect(
            rockPaperScissors.revealResult(0, getHashSecret('secret1'), hashGame)
        ).to.be.revertedWith('incorrect result')

        await expect(
            rockPaperScissors.revealResult(3, getHashSecret('secret1'), hashGame)
        ).to.be.revertedWith('error result')

        const tx = await rockPaperScissors.revealResult(1, getHashSecret('secret1'), hashGame);
        await rockPaperScissors.connect(player2).revealResult(2, getHashSecret('secret2'), hashGame);

        await expect(tx)
            .to.emit(rockPaperScissors, 'Revealed')
            .withArgs(player1.address, hashGame);

        const gameData = await rockPaperScissors.getGame(hashGame);
        expect(gameData.players[0]).to.eq(player1.address);
        expect(gameData.players[1]).to.eq(player2.address);
        expect(gameData.commits[0]).to.true;
        expect(gameData.commits[1]).to.true;
        expect(gameData.results[0]).to.eq(1);
        expect(gameData.results[1]).to.eq(2);
        expect(gameData.winner).to.eq(player2.address);
      });
});