-- MonetizationManager.lua
-- Script: ServerScriptService に配置
-- Game Pass & Developer Product による課金処理
-- 新しい商品の追加はテーブルへの1行追加のみ。ProcessReceipt などの共通処理には触れない。

local Players            = game:GetService("Players")
local MarketplaceService = game:GetService("MarketplaceService")

-- ============================================================
-- 【Game Pass テーブル】
--   新しいGame Passを追加：ここに { id=..., flag=... } を1行追加するだけ
--   id  : Roblox Creator Dashboard で取得したGame Pass ID
--   flag: player:SetAttribute で付与するフラグ名（スクリプト内でこの名前を参照）
-- ============================================================
local GAME_PASSES = {
    { id = 123456789, flag = "hasVIPCar"       },  -- VIPカー解放
    { id = 123456790, flag = "hasDoubleCoin"   },  -- コイン2倍
    { id = 123456791, flag = "hasPremiumColor" },  -- プレミアムカラー
    -- ↑ 新しいGame Passをここに追加
}

-- ============================================================
-- 【Developer Product 効果関数】
-- ============================================================
local function addCoins(player, amount)
    local ls = player:FindFirstChild("leaderstats")
    if ls and ls:FindFirstChild("Coins") then
        ls.Coins.Value += amount
    end
end

local function healPlayer(player)
    -- DeathmatchManager 側が Attribute を監視してHP回復を適用
    player:SetAttribute("RequestHeal", os.clock())
end

local function activateSuperBoost(player)
    -- CarController 側が Attribute を参照して速度倍率に使う（5分間）
    player:SetAttribute("SuperBoostActive", true)
    task.delay(300, function()
        -- プレイヤーがまだいる場合のみ削除
        if player and player.Parent then
            player:SetAttribute("SuperBoostActive", nil)
        end
    end)
end

-- ============================================================
-- 【Developer Product テーブル】
--   新しい商品を追加：[ProductId] = function(player) ... end を1行追加するだけ
--   ProductId : Roblox Creator Dashboard で取得したDeveloper Product ID
-- ============================================================
local DEV_PRODUCTS = {
    [987654321] = function(player) addCoins(player, 100)      end,  -- コイン×100
    [987654322] = function(player) healPlayer(player)         end,  -- 緊急修復キット
    [987654323] = function(player) activateSuperBoost(player) end,  -- スーパーブースト5分
    -- ↑ 新しい商品をここに追加
}

-- ============================================================
-- Game Pass チェック（共通ループ：テーブルに追加しても関数を触る必要なし）
-- ============================================================
local function checkGamePasses(player)
    for _, pass in ipairs(GAME_PASSES) do
        local ok, hasPass = pcall(function()
            return MarketplaceService:UserOwnsGamePassAsync(player.UserId, pass.id)
        end)
        if ok and hasPass then
            player:SetAttribute(pass.flag, true)
        end
    end
end

Players.PlayerAdded:Connect(checkGamePasses)

-- ============================================================
-- Developer Product 購入処理（ProcessReceipt：この関数内は変更不要）
-- ============================================================
MarketplaceService.ProcessReceipt = function(receiptInfo)
    local player = Players:GetPlayerByUserId(receiptInfo.PlayerId)
    if not player then
        -- プレイヤーが見つからない場合は後で再試行
        return Enum.ProductPurchaseDecision.NotProcessedYet
    end

    local handler = DEV_PRODUCTS[receiptInfo.ProductId]
    if handler then
        local ok, err = pcall(handler, player)
        if not ok then
            warn("[MonetizationManager] Developer Product 処理エラー:", err)
            return Enum.ProductPurchaseDecision.NotProcessedYet
        end
    else
        warn("[MonetizationManager] 未登録の ProductId:", receiptInfo.ProductId)
    end

    return Enum.ProductPurchaseDecision.PurchaseGranted
end
