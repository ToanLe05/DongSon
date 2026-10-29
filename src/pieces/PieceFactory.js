import * as PIXI from "pixi.js";
import PieceSprite from "./PieceSprite.js";
import { getAssetTexture, preloadAssets } from "../assets.js";

export default class PieceFactory {
    static create(pieceData, board) {
        if (!pieceData) return null;
        const sprite = new PieceSprite(pieceData, board);
        sprite.label = pieceData.id ?? `${pieceData.color}_${pieceData.type}_${pieceData.square}`;
        this.applyTexture(sprite);
        sprite.setBoardPosition(pieceData.square);
        return sprite;
    }

    static update(sprite, pieceData) {
        if (!sprite) return;
        sprite.updatePiece(pieceData);
        this.applyTexture(sprite);
        sprite.setBoardPosition(pieceData.square);
    }

    static textureName(piece) {
        return `${piece.color}_${piece.type}`.toLowerCase();
    }

    static getTexture(piece) {
        return getAssetTexture(`pieces/${this.textureName(piece)}.png`);
    }

    static applyTexture(sprite) {
        const texture = this.getTexture(sprite);
        if (texture && !sprite.textureSprite) {
            sprite.textureSprite = new PIXI.Sprite(texture);
            sprite.textureSprite.anchor.set(0.5);
            sprite.addChildAt(sprite.textureSprite, 1);
        }
        if (sprite.textureSprite) {
            sprite.textureSprite.visible = Boolean(texture);
            if (texture) {
                sprite.textureSprite.texture = texture;
                const size = sprite.board.cellSize * 0.82;
                sprite.textureSprite.width = size;
                sprite.textureSprite.height = size;
            }
        }
        sprite.body.visible = !texture;
        sprite.pieceLabel.visible = !texture;
    }

    static preload() { return preloadAssets(); }
}

