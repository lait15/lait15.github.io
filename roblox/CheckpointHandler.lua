-- CheckpointHandler.lua
-- LocalScript: StarterPlayerScripts に配置
-- チェックポイントへのタッチを検知してサーバーに通知する

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player    = Players.LocalPlayer
local character = player.Character or player.CharacterAdded:Wait()

-- Remotes が生成されるまで待つ
local remotes      = ReplicatedStorage:WaitForChild("CarGameRemotes", 30)
local evCheckpoint = remotes:WaitForChild("CheckpointPassed", 30)

-- チェックポイントフォルダ（Workspace/Checkpoints に全チェックポイントを格納している想定）
-- 各チェックポイントは "CP_1", "CP_2", … と命名し、属性 "ID" (number) を付ける
local checkpointFolder = workspace:WaitForChild("Checkpoints", 30)

local TOTAL_CHECKPOINTS = 0  -- 後で自動カウント

if checkpointFolder then
    for _, cp in ipairs(checkpointFolder:GetChildren()) do
        if cp:IsA("BasePart") or cp:IsA("Model") then
            TOTAL_CHECKPOINTS += 1
        end
    end
end

-- 車のプライマリパーツを取得（CharacterではなくVehicle）
-- ここではキャラクターが「車に乗っているとき」にタッチ判定する簡易実装
local function setupCheckpoints()
    if not checkpointFolder then
        warn("Checkpoints フォルダが Workspace に見つかりません")
        return
    end

    for _, cp in ipairs(checkpointFolder:GetChildren()) do
        local part = cp:IsA("BasePart") and cp or cp:FindFirstChildWhichIsA("BasePart")
        if not part then continue end

        local cpId = cp:GetAttribute("ID") or tonumber(cp.Name:match("%d+")) or 0

        part.Touched:Connect(function(hit)
            -- プレイヤーのキャラクターか車かを判定
            local hitPlayer = Players:GetPlayerFromCharacter(hit.Parent)
                           or Players:GetPlayerFromCharacter(hit.Parent.Parent)
            if hitPlayer ~= player then return end

            -- チェックポイントをパス
            evCheckpoint:FireServer(cpId, TOTAL_CHECKPOINTS)

            -- 視覚フィードバック（一瞬色が変わる）
            local originalColor = part.BrickColor
            part.BrickColor = BrickColor.new("Bright green")
            task.delay(0.5, function()
                part.BrickColor = originalColor
            end)
        end)
    end
end

setupCheckpoints()

-- チェックポイント数が後から変わった場合に備えて再カウント
checkpointFolder.ChildAdded:Connect(function()
    TOTAL_CHECKPOINTS = 0
    for _, cp in ipairs(checkpointFolder:GetChildren()) do
        if cp:IsA("BasePart") or cp:IsA("Model") then
            TOTAL_CHECKPOINTS += 1
        end
    end
end)
