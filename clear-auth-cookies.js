// 清理 NextAuth cookies 的脚本
// 在浏览器控制台中运行此脚本来清除所有 NextAuth 相关的 cookies

function clearNextAuthCookies() {
  const cookiesToClear = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    'next-auth.pkce.code_verifier'
  ];

  cookiesToClear.forEach(cookieName => {
    // 清除当前域的 cookie
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    
    // 清除带域名的 cookie
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
    
    // 清除带 www 的 cookie
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
  });

  console.log('✅ NextAuth cookies 已清除');
  console.log('请刷新页面或重新登录');
}

// 运行清理函数
clearNextAuthCookies();
