import { useState, useEffect } from "react";

import styles from "./profile.module.scss";

import CloseIcon from "../icons/close.svg";
import { Input, List, ListItem, Modal, PasswordInput } from "./ui-lib";

import { IconButton } from "./button";
import {
  useAuthStore,
  useAccessStore,
  useAppConfig,
  useProfileStore,
  useWebsiteConfigStore,
} from "../store";

import { copyToClipboard } from "../utils";

import Locale from "../locales";
import { Path } from "../constant";
import { ErrorBoundary } from "./error";
import { useNavigate } from "react-router-dom";
import { showToast, Popover } from "./ui-lib";
import { Avatar, AvatarPicker } from "./emoji";
import { Balance } from "../api/users/[...path]/route";

export function Profile() {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const accessStore = useAccessStore();
  const profileStore = useProfileStore();
  const { registerTypes } = useWebsiteConfigStore();
  const registerType = registerTypes[0];
  const REG_TYPE_USERNAME_AND_EMAIL_WITH_CAPTCHA_AND_CODE =
    "UsernameAndEmailWithCaptchaAndCode";

  const config = useAppConfig();
  const updateConfig = config.update;

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const keydownEvent = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        navigate(Path.Home);
      }
    };
    document.addEventListener("keydown", keydownEvent);
    return () => {
      document.removeEventListener("keydown", keydownEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { fetchProfile } = profileStore;
  useEffect(() => {
    setLoading(true);
    fetchProfile(authStore.token, authStore)
      .then((res) => {
        if (!res?.data || !res?.data?.id) {
          authStore.logout();
          navigate(Path.Login);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchProfile, navigate]);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  function logout() {
    setTimeout(() => {
      authStore.logout();
      navigate(Path.Login);
    }, 500);
  }

  function createInviteCode() {
    setLoading(true);
    profileStore
      .createInviteCode(authStore)
      .then((resp) => {
        console.log("resp", resp);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function getPrefix(balance: Balance) {
    return balance.calcType == "Total"
      ? "总额"
      : balance.calcType == "Daily"
        ? Locale.Profile.BalanceItem.CalcTypes.Daily
        : balance.calcType == "Hourly"
          ? Locale.Profile.BalanceItem.CalcTypes.Hourly
          : balance.calcType == "ThreeHourly"
            ? Locale.Profile.BalanceItem.CalcTypes.ThreeHourly
            : "";
  }

  return (
    <ErrorBoundary>
      <div className="window-header" data-tauri-drag-region>
        <div className="window-header-title">
          <div className="window-header-main-title">{Locale.Profile.Title}</div>
          <div className="window-header-sub-title">
            {/* {Locale.Profile.SubTitle} */}
          </div>
        </div>
        <div className="window-actions">
          <div className="window-action-button">
            <IconButton
              icon={<CloseIcon />}
              onClick={() => navigate(Path.Home)}
              bordered
              title={Locale.Profile.Actions.Close}
            />
          </div>
        </div>
      </div>
      <div className={styles["profile"]}>
        <List>
          <ListItem title={Locale.Settings.Avatar}>
            <Popover
              onClose={() => setShowEmojiPicker(false)}
              content={
                <AvatarPicker
                  onEmojiClick={(avatar: string) => {
                    updateConfig((config) => (config.avatar = avatar));
                    setShowEmojiPicker(false);
                  }}
                />
              }
              open={showEmojiPicker}
            >
              <div
                className={styles.avatar}
                onClick={() => setShowEmojiPicker(true)}
              >
                <Avatar avatar={config.avatar} />
              </div>
            </Popover>
          </ListItem>

          <ListItem title={Locale.Profile.Username}>
            <span>{authStore.username}</span>
          </ListItem>

          {authStore.phone ? (
            <ListItem title={Locale.Profile.Phone}>
              <span>{authStore.phone}</span>
            </ListItem>
          ) : (
            <></>
          )}

          {registerType == REG_TYPE_USERNAME_AND_EMAIL_WITH_CAPTCHA_AND_CODE ? (
            <ListItem title={Locale.Profile.Email}>
              <span>{authStore.email}</span>
            </ListItem>
          ) : (
            <></>
          )}
        </List>

        <List>
          {profileStore.invitorId ? (
            <ListItem title={Locale.Profile.Invitor.Title}>
              <span>#{profileStore.invitorId}</span>
            </ListItem>
          ) : (
            <></>
          )}
          <ListItem title={Locale.Profile.InviteCode.Title}>
            {authStore.inviteCode ? (
              <>
                <span>
                  <span
                    className={styles["copy-action"]}
                    onClick={() => {
                      copyToClipboard(authStore.inviteCode);
                    }}
                  >
                    {authStore.inviteCode}
                  </span>
                  <span
                    className={styles["copy-action"]}
                    onClick={() => {
                      copyToClipboard(
                        location.origin +
                          Path.Register +
                          "?code=" +
                          authStore.inviteCode,
                      );
                    }}
                  >
                    {Locale.Profile.Actions.Copy}
                  </span>
                </span>
              </>
            ) : (
              <IconButton
                text={Locale.Profile.Actions.CreateInviteCode}
                type="second"
                disabled={loading}
                onClick={() => {
                  createInviteCode();
                }}
              />
            )}
          </ListItem>
          <ListItem>
            <IconButton
              type="second"
              text="邀请记录"
              onClick={() => navigate(Path.Invitation)}
            />
          </ListItem>
        </List>

        <List>
          {/* 显示加载中或无套餐信息 */}
          {loading ||
          (profileStore.balances && profileStore.balances.length === 0) ? (
            <div
              style={{
                borderBottom: "var(--border-in-light)",
                minHeight: "40px",
                lineHeight: "40px",
                padding: "10px 20px",
                textAlign: "center",
              }}
            >
              {loading
                ? "加载中"
                : profileStore.balances && profileStore.balances.length === 0
                  ? "您尚未购买任何套餐"
                  : ""}
            </div>
          ) : (
            <>
              {/* 筛选未过期且 tokens > 0 的套餐 */}
              {profileStore.balances
                .filter((balance) => !balance.expired && balance.tokens > 0) // 过滤未过期且 tokens > 0 的套餐
                .sort((a, b) => b.tokens - a.tokens) // 按 tokens 降序排序
                .map((balance, index) => (
                  <ListItem key={index}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <span>
                        算力积分:{" "}
                        {balance.tokens === -1 ? "无限" : balance.tokens}
                      </span>
                      <span>过期时间: {balance.expireTime}</span>
                    </div>
                  </ListItem>
                ))}

              {/* 如果有已过期的套餐，显示数量 */}
              {profileStore.balances.filter((balance) => balance.expired)
                .length > 0 && (
                <ListItem>
                  <span>
                    还有{" "}
                    {
                      profileStore.balances.filter((balance) => balance.expired)
                        .length
                    }{" "}
                    个已过期套餐
                  </span>
                </ListItem>
              )}
            </>
          )}

          {/* 显示 "全部套餐" 按钮，仅当有有效套餐存在 */}
          {profileStore.balances && profileStore.balances.length > 0 && (
            <ListItem>
              <IconButton
                text={Locale.Profile.Actions.All}
                type="second"
                style={{ flexShrink: 0 }}
                onClick={() => {
                  navigate(Path.Balance);
                }}
              />
            </ListItem>
          )}

          {/* 操作按钮：余额日志 和 兑换 */}
          <ListItem>
            <div style={{ display: "flex" }}>
              <IconButton
                text={Locale.Profile.Actions.BalanceLog}
                type="second"
                style={{ marginRight: "10px" }}
                onClick={() => {
                  navigate(Path.BalanceLog);
                }}
              />
              <IconButton
                text={Locale.Profile.Actions.Redeem}
                type="second"
                onClick={() => {
                  navigate(Path.RedeemCode);
                }}
              />
            </div>
          </ListItem>
        </List>

        <List>
          <ListItem>
            <IconButton
              text={Locale.Profile.Actions.Pricing}
              block={true}
              type="primary"
              onClick={() => {
                navigate(Path.Pricing);
              }}
            />
          </ListItem>

          <ListItem>
            <IconButton
              text={Locale.Profile.Actions.Order}
              block={true}
              type="second"
              onClick={() => {
                navigate(Path.Order);
              }}
            />
          </ListItem>

          <ListItem>
            <IconButton
              text={Locale.LoginPage.Actions.Logout}
              block={true}
              type="second"
              onClick={() => {
                logout();
              }}
            />
          </ListItem>
        </List>
      </div>
    </ErrorBoundary>
  );
}
